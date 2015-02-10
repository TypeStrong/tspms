'use strict';
var ts = require('typescript');
var path = require('path');
var promise = require('./promise');
var fs = require('./fileSystem');
var ws = require('./workingSet');
var utils = require('./utils');
var Logger = require('./logger');
var LanguageServiceHost = require('./languageServiceHost');
var CompilerManager = require('./compilerManager');
/**
 * Describe the relation between a file and a project
 */
(function (ProjectFileKind) {
    /**
     * The file is not a part of the project.
     */
    ProjectFileKind[ProjectFileKind["NONE"] = 0] = "NONE";
    /**
     * The file is a source file of the project.
     */
    ProjectFileKind[ProjectFileKind["SOURCE"] = 1] = "SOURCE";
    /**
     * The file is referenced by a source file of the project.
     */
    ProjectFileKind[ProjectFileKind["REFERENCE"] = 2] = "REFERENCE";
})(exports.ProjectFileKind || (exports.ProjectFileKind = {}));
var ProjectFileKind = exports.ProjectFileKind;
//--------------------------------------------------------------------------
//
//  TypeScriptProject Factory
//
//--------------------------------------------------------------------------
/**
 * TypeScriptProject factory.
 *
 * @param currentDir the absolute path to the current directory opended in the editor.
 * @param config the project configuration.
 * @param fileSystem the fileSystem wrapper instance used by this project.
 */
function createProject(currentDir, config, fileSystem, workingSet) {
    //--------------------------------------------------------------------------
    //
    //  Internal API
    //
    //--------------------------------------------------------------------------
    /**
     * The configuration associated to the project.
     */
    var _config = utils.clone(config);
    /**
     * The LanguageServicehost instance managed by the project.
     */
    var languageServiceHost;
    /**
     * The LanguageService instance managed by this project.
     */
    var languageService;
    /**
     * The set of files composing the project.
     */
    var projectFilesSet;
    /**
     * A map of set describing references between projects Files
     */
    var references;
    /**
     * A promise queue used to insure that fileSystem operaion are run in sequence.
     */
    var queue = utils.createPromiseQueue();
    /**
     * Compiler information for the typescript compiler used by the project.
     */
    var typeScriptInfo;
    //-------------------------------
    //  Project Files Management
    //-------------------------------
    /**
     * Update the languageService host script 'open' status according to file in the working set.
     */
    function updateWorkingSet() {
        workingSet.getFiles().then(function (files) { return files.forEach(function (fileName) {
            if (projectFilesSet[fileName]) {
                languageServiceHost.setScriptIsOpen(fileName, true);
            }
        }); });
    }
    /**
     * Retrieves the files content for path matching the config sources patterns.
     */
    function collectFiles() {
        return fileSystem.getProjectFiles().then(function (files) {
            var promises = [];
            files.forEach(function (fileName) {
                if (isProjectSourceFile(fileName) && !projectFilesSet[fileName]) {
                    promises.push(addFile(fileName));
                }
            });
            if (!_config.compilerOptions.noLib && !projectFilesSet[typeScriptInfo.defaultLibFileName]) {
                promises.push(addFile(typeScriptInfo.defaultLibFileName));
            }
            return promise.Promise.all(promises);
        });
    }
    /**
     * Return true a if a given file path match the config sources patterns.
     *
     * @param fileName the absolute file name.
     */
    function isProjectSourceFile(fileName) {
        return utils.match(currentDir, fileName, _config.sources);
    }
    /**
     * Add a file to the project and all references of this file.
     *
     * @param fileName the absolute file name.
     */
    function addFile(fileName) {
        if (!projectFilesSet[fileName]) {
            projectFilesSet[fileName] = true;
            return fileSystem.readFile(fileName).then(function (content) {
                var promises = [];
                languageServiceHost.addScript(fileName, content);
                getReferencedOrImportedFiles(fileName).forEach(function (referencedFile) {
                    promises.push(addFile(referencedFile));
                    addReference(fileName, referencedFile);
                });
                return promise.Promise.all(promises);
            }, function () {
                delete projectFilesSet[fileName];
            });
        }
        return null;
    }
    /**
     * Remove a file from the project, and all references that are not referenced by another file.
     *
     * @param fileName the absolute file name.
     */
    function removeFile(fileName) {
        if (projectFilesSet[fileName]) {
            getReferencedOrImportedFiles(fileName).forEach(function (referencedFileName) {
                removeReference(fileName, referencedFileName);
            });
            delete projectFilesSet[fileName];
            languageServiceHost.removeScript(fileName);
        }
    }
    /**
     * Update a project file content.
     *
     * @param fileName the absolute file name.
     */
    function updateFile(fileName) {
        fileSystem.readFile(fileName).then(function (content) {
            var oldPaths = utils.arrayToSet(getReferencedOrImportedFiles(fileName));
            languageServiceHost.updateScript(fileName, content);
            updateReferences(fileName, oldPaths);
        });
    }
    //-------------------------------
    //  References management
    //-------------------------------
    /**
     * For a given file retrives the file referenced or imported by this file.
     *
     * @param fileName the absolute fileName of the file.
     */
    function getReferencedOrImportedFiles(fileName) {
        if (!projectFilesSet[fileName]) {
            return [];
        }
        var preProcessedFileInfo = ts.preProcessFile(languageServiceHost.getScriptContent(fileName), true);
        var dir = path.dirname(fileName);
        return preProcessedFileInfo.referencedFiles.map(function (fileReference) {
            return utils.pathResolve(dir, fileReference.filename);
        }).concat(preProcessedFileInfo.importedFiles.map(function (fileReference) {
            return utils.pathResolve(dir, fileReference.filename + '.ts');
        }));
    }
    /**
     * Add a reference.
     *
     * @param fileName the absolute fileName of the file referencing another file.
     * @param referencedFileName the absolute fileName of the file referenced.
     */
    function addReference(fileName, referencedFileName) {
        if (!references[referencedFileName]) {
            references[referencedFileName] = Object.create(null);
        }
        references[referencedFileName][fileName] = true;
    }
    /**
     * Remove a reference, if the referenced file is not referenced anymore by any
     * other file, remove that file from the project
     *
     * @param fileName the absolute fileName of the file referencing another file.
     * @param referencedFileName he absolute fileName of the file referenced.
     */
    function removeReference(fileName, referencedFileName) {
        var fileRefs = references[referencedFileName];
        if (!fileRefs) {
            removeFile(referencedFileName);
        }
        delete fileRefs[fileName];
        if (Object.keys(fileRefs).length === 0) {
            delete references[referencedFileName];
            if (!isProjectSourceFile(referencedFileName)) {
                removeFile(referencedFileName);
            }
        }
    }
    /**
     * Update file references after an update.
     *
     * @param fileName the absolute file name.
     * @param oldFileReferences the set of file this file referenced before being updated.
     */
    function updateReferences(fileName, oldFileReferences) {
        getReferencedOrImportedFiles(fileName).forEach(function (referencedPath) {
            delete oldFileReferences[referencedPath];
            if (!projectFilesSet[referencedPath]) {
                addFile(referencedPath);
                addReference(fileName, referencedPath);
            }
        });
        Object.keys(oldFileReferences).forEach(function (referencedPath) { return removeReference(fileName, referencedPath); });
    }
    //-------------------------------
    //  Events Handler
    //-------------------------------
    /**
     * Handle changes in the file system.
     *
     * @param changeRecords file system changes descriptors.
     */
    function filesChangeHandler(changeRecords) {
        queue.then(function () {
            changeRecords.forEach(function (record) {
                switch (record.kind) {
                    case 0 /* ADD */:
                        if (isProjectSourceFile(record.fileName) || references[record.fileName]) {
                            addFile(record.fileName);
                        }
                        break;
                    case 2 /* DELETE */:
                        if (projectFilesSet[record.fileName]) {
                            removeFile(record.fileName);
                        }
                        break;
                    case 1 /* UPDATE */:
                        if (projectFilesSet[record.fileName]) {
                            updateFile(record.fileName);
                        }
                        else if (record.fileName === typeScriptInfo.servicesFileName) {
                            languageService.dispose();
                            return init();
                        }
                        break;
                }
            });
        });
    }
    ;
    /**
     * Handle changes in the working set.
     *
     * @param changeRecord working set change descriptor.
     */
    function workingSetChangedHandler(changeRecord) {
        queue.then(function () {
            switch (changeRecord.kind) {
                case 0 /* ADD */:
                    changeRecord.fileNames.forEach(function (fileName) {
                        if (projectFilesSet[fileName]) {
                            languageServiceHost.setScriptIsOpen(fileName, true);
                        }
                    });
                    break;
                case 1 /* REMOVE */:
                    changeRecord.fileNames.forEach(function (fileName) {
                        if (projectFilesSet[fileName]) {
                            languageServiceHost.setScriptIsOpen(fileName, false);
                            updateFile(fileName);
                        }
                    });
                    break;
            }
        });
    }
    ;
    /**
     * Handle document edition.
     *
     * @param record edition descriptor.
     */
    function documentEditedHandler(record) {
        queue.then(function () {
            if (projectFilesSet[record.fileName]) {
                var oldPaths = utils.arrayToSet(getReferencedOrImportedFiles(record.fileName));
                if (record.documentText) {
                    languageServiceHost.updateScript(record.fileName, record.documentText);
                }
                else {
                    record.changeList.forEach(function (change) {
                        languageServiceHost.editScript(record.fileName, change.from, change.to, change.text);
                    });
                }
                updateReferences(record.fileName, oldPaths);
            }
        });
    }
    ;
    //--------------------------------------------------------------------------
    //
    //  Public API
    //
    //--------------------------------------------------------------------------
    /**
     * Initialize the project.
     */
    function init() {
        projectFilesSet = Object.create(null);
        references = Object.create(null);
        workingSet.workingSetChanged.add(workingSetChangedHandler);
        workingSet.documentEdited.add(documentEditedHandler);
        fileSystem.projectFilesChanged.add(filesChangeHandler);
        var compilerDirectory = _config.compilerDirectory;
        return queue.reset(new promise.Promise(function (resolve, reject) {
            if (!compilerDirectory) {
                resolve(CompilerManager.getDefaultTypeScriptInfo());
            }
            else {
                resolve(CompilerManager.acquireCompiler(_config.compilerDirectory).catch(function (e) {
                    //TODO instead of silently returning default we should handle this error in project
                    //manager and return an error in the linter
                    Logger.warn('could not retrieve typescript compiler at path: ' + compilerDirectory);
                    return CompilerManager.getDefaultTypeScriptInfo();
                }));
            }
        }).then(function (info) {
            typeScriptInfo = info;
            languageServiceHost = LanguageServiceHost.create(currentDir, typeScriptInfo.defaultLibFileName);
            languageServiceHost.setCompilationSettings(utils.clone(_config.compilerOptions));
            languageService = typeScriptInfo.ts.createLanguageService(languageServiceHost, info.documentRegistry);
            return collectFiles().then(updateWorkingSet);
        }));
    }
    /**
     * Update a project accordingly to a new configuration.
     *
     * @param config the new project configuration.
     */
    function update(config) {
        if (config.compilerDirectory !== _config.compilerDirectory) {
            CompilerManager.releaseCompiler(typeScriptInfo);
            languageService.dispose();
            return init();
        }
        if (!_config.compilerOptions.noLib && config.compilerOptions.noLib) {
            removeFile(typeScriptInfo.defaultLibFileName);
        }
        languageService.cleanupSemanticCache();
        var pojectSources = Object.keys(projectFilesSet).filter(function (fileName) { return isProjectSourceFile(fileName); });
        _config = config;
        return queue.then(function () {
            languageServiceHost.setCompilationSettings(_config.compilerOptions);
            var promises = [];
            pojectSources.forEach(function (fileName) {
                if (!isProjectSourceFile(fileName)) {
                    removeFile(fileName);
                }
            });
            return promise.Promise.all(promises).then(function () { return collectFiles(); }).then(function () { return updateWorkingSet(); });
        });
    }
    /**
     * Dispose the project.
     */
    function dispose() {
        workingSet.workingSetChanged.remove(workingSetChangedHandler);
        workingSet.documentEdited.remove(documentEditedHandler);
        fileSystem.projectFilesChanged.remove(filesChangeHandler);
        CompilerManager.releaseCompiler(typeScriptInfo);
        languageService.dispose();
    }
    /**
     * For a given file, give the relation between the project an the associated file.
     *
     * @param fileName the absolute file name of the file.
     */
    function getProjectFileKind(fileName) {
        return !!projectFilesSet[fileName] ? (isProjectSourceFile(fileName) ? 1 /* SOURCE */ : 2 /* REFERENCE */) : 0 /* NONE */;
    }
    return {
        init: init,
        update: update,
        dispose: dispose,
        getProjectFileKind: getProjectFileKind,
        getLanguageService: function () { return languageService; },
        getLanguageServiceHost: function () { return languageServiceHost; },
        getProjectFilesSet: function () { return utils.clone(projectFilesSet); },
        getTypeScriptInfo: function () { return typeScriptInfo; }
    };
}
exports.createProject = createProject;
