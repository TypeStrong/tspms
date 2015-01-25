'use strict';
var ts = require('typescript');
var path = require('path');
var minimatch = require('minimatch');
var promise = require('./promise');
var fs = require('./fileSystem');
var ws = require('./workingSet');
var utils = require('./utils');
var console = require('./logger');
var LanguageServiceHost = require('./languageServiceHost');
(function (ProjectFileKind) {
    /**
     * the file is not a part of the project
     */
    ProjectFileKind[ProjectFileKind["NONE"] = 0] = "NONE";
    /**
     * the file is a source file of the project
     */
    ProjectFileKind[ProjectFileKind["SOURCE"] = 1] = "SOURCE";
    /**
     * the file is referenced by a source file of the project
     */
    ProjectFileKind[ProjectFileKind["REFERENCE"] = 2] = "REFERENCE";
})(exports.ProjectFileKind || (exports.ProjectFileKind = {}));
var ProjectFileKind = exports.ProjectFileKind;
function createProject(documentRegistry, baseDirectory, config, fileSystem, workingSet, defaultLibLocation) {
    //-------------------------------
    //  variables
    //-------------------------------
    /**
     * Configuration of this project
     */
    var _config = utils.clone(config);
    /**
     * Language Service host instance managed by this project
     */
    var languageServiceHost;
    /**
     * LanguageService managed by this project
     */
    var languageService;
    /**
     * Map path to content
     */
    var projectFilesSet;
    /**
     * store file references
     */
    var references;
    /**
     * a promise queue used to run in sequence file based operation
     */
    var queue = utils.createPromiseQueue();
    /**
     * info for the curently use typescript compiler
     */
    var typeScriptInfo;
    //-------------------------------
    //  private methods
    //-------------------------------
    /**
     * Retrieve a ServiceFactory from a given typeScriptService file path
     * @param typescriptPath
     */
    function getTypeScriptInfosForPath(typescriptPath) {
        var defaultTypeScript = promise.Promise.resolve({
            typeScript: ts,
            libLocation: defaultLibLocation
        });
        if (!typescriptPath) {
            return defaultTypeScript;
        }
        else {
            return promise.Promise.resolve().then(function () {
                var typescriptServicesFile = path.join(typescriptPath, 'bin', 'typescriptServices.js');
                var libFile = path.join(typescriptPath, 'bin', 'lib.d.ts');
                return fileSystem.readFile(typescriptServicesFile).then(function (code) {
                    var func = new Function(code + ';return ts;'), generatedTs = func();
                    if (!generatedTs) {
                        throw new Error('Invalid typescript file');
                    }
                    return {
                        typeScript: generatedTs,
                        libLocation: libFile
                    };
                });
            }).catch(function (e) {
                //TODO instead of silently returning default we should handle this error in project
                //manager and return an error in the linter
                console.warn('could not retrieve typescript compiler at path: ' + typescriptPath);
                return defaultTypeScript;
            });
        }
    }
    /**
     * update the languageService host script 'open' status
     * according to file in the working set
     */
    function updateWorkingSet() {
        workingSet.getFiles().then(function (files) { return files.forEach(function (fileName) {
            if (projectFilesSet[fileName]) {
                languageServiceHost.setScriptIsOpen(fileName, true);
            }
        }); });
    }
    //-------------------------------
    //  Project Files Management
    //-------------------------------
    /**
     * retrieve files content for path match described in the config
     */
    function collectFiles() {
        return fileSystem.getProjectFiles().then(function (files) {
            var promises = [];
            files.forEach(function (fileName) {
                if (isProjectSourceFile(fileName) && !projectFilesSet[fileName]) {
                    promises.push(addFile(fileName, false));
                }
            });
            if (!_config.compilationSettings.noLib && !projectFilesSet[typeScriptInfo.libLocation]) {
                promises.push(addFile(typeScriptInfo.libLocation));
            }
            return promise.Promise.all(promises);
        });
    }
    /**
     * return true a if a given file path match the config
     * @param path
     */
    function isProjectSourceFile(fileName) {
        var relativeFileName = path.relative(baseDirectory, fileName);
        return _config.sources.some(function (pattern) { return minimatch(relativeFileName, pattern) || minimatch(fileName, pattern); });
    }
    /**
     * add a file to the project and all file that this file reference
     * @param path
     */
    function addFile(fileName, notify) {
        if (notify === void 0) { notify = true; }
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
     * remove a file from the project
     * @param path
     */
    function removeFile(fileName) {
        if (projectFilesSet[fileName]) {
            getReferencedOrImportedFiles(fileName).forEach(function (referencedPath) {
                removeReference(fileName, referencedPath);
            });
            delete projectFilesSet[fileName];
            languageServiceHost.removeScript(fileName);
        }
    }
    /**
     * update a project file
     * @param path
     */
    function updateFile(fileName) {
        fileSystem.readFile(fileName).then(function (content) {
            var oldPaths = utils.createMap(getReferencedOrImportedFiles(fileName));
            languageServiceHost.updateScript(fileName, content);
            updateReferences(fileName, oldPaths);
        });
    }
    //-------------------------------
    //  References
    //-------------------------------
    /**
     * for a given file retrives the file referenced or imported by this file
     * @param path
     */
    function getReferencedOrImportedFiles(fileName) {
        if (!projectFilesSet[fileName]) {
            return [];
        }
        var preProcessedFileInfo = ts.preProcessFile(languageServiceHost.getScriptContent(fileName), true), dir = path.dirname(fileName);
        return preProcessedFileInfo.referencedFiles.map(function (fileReference) {
            return utils.pathResolve(dir, fileReference.filename);
        }).concat(preProcessedFileInfo.importedFiles.map(function (fileReference) {
            return utils.pathResolve(dir, fileReference.filename + '.ts');
        }));
    }
    /**
     * add a reference
     *
     * @param fileName the path of the file referencing anothe file
     * @param referencedPath the path of the file referenced
     */
    function addReference(fileName, referencedPath) {
        if (!references[referencedPath]) {
            references[referencedPath] = Object.create(null);
        }
        references[referencedPath][fileName] = true;
    }
    /**
     * remove a reference
     *
     * @param fileName the path of the file referencing anothe file
     * @param referencedPath the path of the file referenced
     */
    function removeReference(fileName, referencedPath) {
        var fileRefs = references[referencedPath];
        if (!fileRefs) {
            removeFile(referencedPath);
        }
        delete fileRefs[fileName];
        if (Object.keys(fileRefs).length === 0) {
            delete references[referencedPath];
            removeFile(referencedPath);
        }
    }
    /**
     * update file references after an update
     *
     * @param fileName the absolute path of the file
     * @param oldFileReferences list of file this file referenced before being updated
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
     * handle changes in the fileSystem
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
                        break;
                }
            });
        });
    }
    ;
    /**
     * handle changes in the workingSet
     */
    function workingSetChangedHandler(changeRecord) {
        queue.then(function () {
            switch (changeRecord.kind) {
                case 0 /* ADD */:
                    changeRecord.paths.forEach(function (fileName) {
                        if (projectFilesSet[fileName]) {
                            languageServiceHost.setScriptIsOpen(fileName, true);
                        }
                    });
                    break;
                case 1 /* REMOVE */:
                    changeRecord.paths.forEach(function (fileName) {
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
     * handle document edition
     */
    function documentEditedHandler(record) {
        queue.then(function () {
            if (projectFilesSet[record.path]) {
                var mustUpdate = false, oldPaths = utils.createMap(getReferencedOrImportedFiles(record.path)), lastChange;
                record.changeList.some(function (change) {
                    lastChange = change;
                    if (!change.from || !change.to) {
                        mustUpdate = true;
                    }
                    else {
                        var minChar = languageServiceHost.getIndexFromPosition(record.path, change.from), limChar = languageServiceHost.getIndexFromPosition(record.path, change.to);
                        languageServiceHost.editScript(record.path, minChar, limChar, change.text);
                    }
                    return mustUpdate;
                });
                if (mustUpdate || languageServiceHost.getScriptContent(record.path) !== record.documentText) {
                    if (mustUpdate) {
                        console.warn('TypeScriptProject: inconsistent change descriptor: %s', JSON.stringify(lastChange, null, 4));
                    }
                    else {
                        console.warn('TypeScriptProject: text different before and after change');
                    }
                    languageServiceHost.updateScript(record.path, record.documentText);
                }
                updateReferences(record.path, oldPaths);
            }
        });
    }
    ;
    //-------------------------------
    //  public methods
    //-------------------------------
    /**
     * Initialize the project an his component
     */
    function init() {
        projectFilesSet = Object.create(null);
        references = Object.create(null);
        workingSet.workingSetChanged.add(workingSetChangedHandler);
        workingSet.documentEdited.add(documentEditedHandler);
        fileSystem.projectFilesChanged.add(filesChangeHandler);
        return queue.reset(getTypeScriptInfosForPath(_config.typescriptPath).then(function (info) {
            typeScriptInfo = info;
            languageServiceHost = LanguageServiceHost.create(baseDirectory, typeScriptInfo.libLocation);
            languageServiceHost.setCompilationSettings(utils.clone(_config.compilationSettings));
            languageService = typeScriptInfo.typeScript.createLanguageService(languageServiceHost, documentRegistry);
            return collectFiles().then(updateWorkingSet);
        }));
    }
    /**
     * update a project with a new config
     */
    function update(config) {
        if (config.typescriptPath !== _config.typescriptPath) {
            languageService.dispose();
            return init();
        }
        languageService.cleanupSemanticCache();
        if (!_config.compilationSettings.noLib && config.compilationSettings.noLib) {
            removeFile(typeScriptInfo.libLocation);
        }
        var pojectSources = Object.keys(projectFilesSet).filter(function (fileName) { return isProjectSourceFile(fileName); });
        _config = config;
        return queue.then(function () {
            languageServiceHost.setCompilationSettings(_config.compilationSettings);
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
     * dispose the project
     */
    function dispose() {
        workingSet.workingSetChanged.remove(workingSetChangedHandler);
        workingSet.documentEdited.remove(documentEditedHandler);
        fileSystem.projectFilesChanged.remove(filesChangeHandler);
        languageService.dispose();
    }
    /**
     * for a given path, give the relation between the project an the associated file
     * @param path
     */
    function getProjectFileKind(fileName) {
        return !!projectFilesSet[fileName] ? (isProjectSourceFile(fileName) ? 1 /* SOURCE */ : 2 /* REFERENCE */) : 0 /* NONE */;
    }
    return {
        init: init,
        update: update,
        dispose: dispose,
        getLanguageService: function () { return languageService; },
        getLanguageServiceHost: function () { return languageServiceHost; },
        getProjectFilesSet: function () { return utils.clone(projectFilesSet); },
        getProjectFileKind: getProjectFileKind,
        getTypeScriptInfo: function () { return typeScriptInfo; }
    };
}
exports.createProject = createProject;
