//   Copyright 2013-2014 François de Campredon
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.
'use strict';
var ts = require('typescript');
var path = require('path');
var minimatch = require('minimatch');
var Promise = require('bluebird');
var fs = require('./fileSystem');
var ws = require('./workingSet');
var utils = require('./utils');
var PromiseQueue = utils.PromiseQueue;
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
function createProject(baseDirectory, config, fileSystem, workingSet, defaultLibLocation) {
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
    var queue = new PromiseQueue();
    /**
     * location of the typescript 'lib.d.ts' file
     */
    var libLocation;
    var typeScriptInfo;
    //-------------------------------
    //  private methods
    //-------------------------------
    /**
     * Retrieve a ServiceFactory from a given typeScriptService file path
     * @param typescriptPath
     */
    function getTypeScriptInfosForPath(typescriptPath) {
        return {
            typeScript: ts,
            libLocation: defaultLibLocation
        };
        //TODO
        //        if (!typescriptPath) {
        //            return {
        //                typeScript:  ts,
        //                libLocation: defaultLibLocation
        //            };
        //        } else {
        //            var typescriptServicesFile = path.join(typescriptPath, 'bin', 'typescriptServices.js');
        //            try {
        //                var generatedTs = require(typescriptPath);
        //                return {
        //                    typeScript: generatedTs,
        //                    libLocation: path.join(typescriptPath, 'lib.d.ts')
        //                };
        //            } catch(e) {
        //                //TODO instead of silently returning default we should handle this error in project
        //                //manager and return an error in the linter
        //                if (logger.error()) {
        //                    logger.log('could not retrieve typescript compiler at path: ' + typescriptPath);
        //                }
        //                return {
        //                    typeScript: ts,
        //                    libLocation: defaultLibLocation
        //                };
        //            }
        //        }
    }
    /**
     * create Typescript compilation settings from config file
     */
    function createCompilationSettings() {
        var compilationSettings = {}, moduleType = _config.module.toLowerCase();
        compilationSettings.noLib = _config.noLib;
        compilationSettings.noImplicitAny = _config.noImplicitAny;
        compilationSettings.sourceRoot = _config.sourceRoot;
        compilationSettings.target = _config.target.toLowerCase() === 'es3' ? 0 /* ES3 */ : 1 /* ES5 */;
        compilationSettings.module = moduleType === 'none' ? 0 /* None */ : moduleType === 'amd' ? 2 /* AMD */ : 1 /* CommonJS */;
        return compilationSettings;
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
            if (!_config.noLib && !projectFilesSet[libLocation]) {
                promises.push(addFile(libLocation));
            }
            return Promise.all(promises);
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
                return Promise.all(promises);
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
                    //TODO
                    //                    if (logger.warning()) {
                    //                        if (mustUpdate) {
                    //                            logger.log('TypeScriptProject: inconsistent change descriptor: ' + JSON.stringify(lastChange));
                    //                        } else {
                    //                            logger.log('TypeScriptProject: text different before and after change');
                    //                        }
                    //                    }
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
        typeScriptInfo = getTypeScriptInfosForPath(_config.typescriptPath);
        libLocation = typeScriptInfo.libLocation;
        languageServiceHost = LanguageServiceHost.create(baseDirectory, libLocation);
        languageServiceHost.setCompilationSettings(createCompilationSettings());
        languageService = typeScriptInfo.typeScript.createLanguageService(languageServiceHost, typeScriptInfo.typeScript.createDocumentRegistry());
        return queue.init(collectFiles().then(updateWorkingSet));
    }
    /**
     * update a project with a new config
     */
    function update(config) {
        if (config.typescriptPath !== _config.typescriptPath) {
            return init();
        }
        if (!_config.noLib && config.noLib) {
            removeFile(libLocation);
        }
        var pojectSources = Object.keys(projectFilesSet).filter(function (fileName) { return isProjectSourceFile(fileName); });
        _config = config;
        return queue.then(function () {
            languageServiceHost.setCompilationSettings(createCompilationSettings());
            var promises = [];
            pojectSources.forEach(function (fileName) {
                if (!isProjectSourceFile(fileName)) {
                    removeFile(fileName);
                }
            });
            return Promise.all(promises).then(function () { return collectFiles(); }).then(function () { return updateWorkingSet(); });
        });
    }
    /**
     * dispose the project
     */
    function dispose() {
        workingSet.workingSetChanged.remove(workingSetChangedHandler);
        workingSet.documentEdited.remove(documentEditedHandler);
        fileSystem.projectFilesChanged.remove(filesChangeHandler);
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
