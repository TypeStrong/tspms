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

import ts           = require('typescript');
import path         = require('path');
import minimatch    = require('minimatch');
import Promise      = require('bluebird');


import fs           = require('./fileSystem');
import ws           = require('./workingSet');

import utils        = require('./utils');
import PromiseQueue = utils.PromiseQueue



import LanguageServiceHost      = require('./languageServiceHost');

//--------------------------------------------------------------------------
//
//  TypeScriptProject
//
//--------------------------------------------------------------------------

/**
 * Project Configuration
 */
export interface TypeScriptProjectConfig {
    
    //---------------------------------------------
    //  Brackets-Typescript Specific settings
    //---------------------------------------------
    
    /**
     * Array of minimatch pattern string representing 
     * sources of a project
     */
    sources?: string[];
    
    /**
     * Path to an alternative typescriptCompiler
     */
    typescriptPath?: string;
    
    
    //---------------------------------------------
    //  Compiler Settings
    //---------------------------------------------
    
    /**
     * should the project include the default typescript library file
     */
    noLib?: boolean;
    /**
     * 
     */
    target?: string;
    
    /**
     * Specify ECMAScript target version: 'ES3' (default), or 'ES5'
     */
    module?: string;
    
    /**
     * Specifies the location where debugger should locate TypeScript files instead of source locations.
     */
    sourceRoot?: string;
    
    /**
     *  Warn on expressions and declarations with an implied 'any' type.
     */
    noImplicitAny?: boolean;
}

export interface TypeScriptProject {
    
    //-------------------------------
    //  public methods
    //-------------------------------
    
    /**
     * Initialize the project an his component
     */
    init(): Promise<void>;

    
    /**
     * update a project with a new config
     */
    update(config: TypeScriptProjectConfig): Promise<void>;
    
    /**
     * dispose the project
     */
    dispose():void


    
    /**
     * return the language service host of the project
     */
    getLanguageServiceHost(): LanguageServiceHost;
    
    /**
     * return the languageService used by the project
     */
    getLanguageService(): ts.LanguageService;
    
    
    /**
     * return the typescript info used by the project
     */
    getTypeScriptInfo(): TypeScriptInfo;
    
    
    //-------------------------------
    //  exposed files informations
    //-------------------------------
    /**
     * return the set of files contained in the project
     */
    getProjectFilesSet(): { [path :string]: boolean };
    
    /**
     * for a given path, give the relation between the project an the associated file
     * @param path
     */
    getProjectFileKind(fileName: string): ProjectFileKind;
}


export enum ProjectFileKind {
    /**
     * the file is not a part of the project
     */
    NONE,
    /**
     * the file is a source file of the project
     */
    SOURCE,
    /**
     * the file is referenced by a source file of the project
     */
    REFERENCE
}




export type TypeScriptInfo = {
    typeScript: typeof ts
    libLocation: string;
}

export function createProject(
    baseDirectory: string, 
    config: TypeScriptProjectConfig, 
    fileSystem: fs.IFileSystem, 
    workingSet: ws.IWorkingSet, 
    defaultLibLocation: string ): TypeScriptProject {
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
    var languageServiceHost: LanguageServiceHost;
    
    /**
     * LanguageService managed by this project
     */
    var languageService: ts.LanguageService;
    
    /**
     * Map path to content
     */
    var projectFilesSet: { [string: string]: boolean };
    
    /**
     * store file references
     */
    var references:{ [string: string]: { [string: string]: boolean } };
    
    
    /**
     * a promise queue used to run in sequence file based operation
     */
    var queue: PromiseQueue = new PromiseQueue();
    
    /**
     * location of the typescript 'lib.d.ts' file
     */
    var libLocation: string;
    
    
    var typeScriptInfo: TypeScriptInfo;
    
    
    
    //-------------------------------
    //  private methods
    //-------------------------------
    
    /**
     * Retrieve a ServiceFactory from a given typeScriptService file path
     * @param typescriptPath
     */
    function getTypeScriptInfosForPath(typescriptPath: string): TypeScriptInfo {
        return {
            typeScript:  ts,
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
    function createCompilationSettings(): ts.CompilerOptions {
        var compilationSettings = <ts.CompilerOptions>{},
            moduleType = _config.module.toLowerCase();
        
        compilationSettings.noLib = _config.noLib;
        compilationSettings.noImplicitAny = _config.noImplicitAny;
        compilationSettings.sourceRoot = _config.sourceRoot;
        
        compilationSettings.target = 
            _config.target.toLowerCase() === 'es3' ? 
                ts.ScriptTarget.ES3: 
                ts.ScriptTarget.ES5;
        
        compilationSettings.module = 
            moduleType === 'none' ? 
                ts.ModuleKind.None : 
                moduleType === 'amd' ?
                    ts.ModuleKind.AMD :
                    ts.ModuleKind.CommonJS
            ;
        
        return compilationSettings;
    }
    
    /**
     * update the languageService host script 'open' status 
     * according to file in the working set
     */
    function updateWorkingSet() {
        workingSet.getFiles().then(files => files.forEach(fileName => {
            if (projectFilesSet[fileName]) {
                languageServiceHost.setScriptIsOpen(fileName, true);
            }
        }));
    }
    
    
    //-------------------------------
    //  Project Files Management
    //-------------------------------
    
    /**
     * retrieve files content for path match described in the config
     */
    function collectFiles(): Promise<any> { 
        return fileSystem.getProjectFiles().then(files => {
            var promises: Promise<any>[] = [];
            files.forEach(fileName => {
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
    function isProjectSourceFile(fileName: string): boolean {
        var relativeFileName = path.relative(baseDirectory, fileName);
        return _config.sources.some(pattern => minimatch(relativeFileName, pattern) || minimatch(fileName, pattern));
    }
    
   
    /**
     * add a file to the project and all file that this file reference
     * @param path
     */
    function addFile(fileName: string, notify = true): Promise<any>  {
        if (!projectFilesSet[fileName]) {
            projectFilesSet[fileName] = true;
            return fileSystem.readFile(fileName).then(content => {
                var promises: Promise<any>[] = [];
                languageServiceHost.addScript(fileName, content);
                getReferencedOrImportedFiles(fileName).forEach(referencedFile => {
                    promises.push(addFile(referencedFile));
                    addReference(fileName, referencedFile);
                });
                return Promise.all(promises);
            }, (): any => {
                delete projectFilesSet[fileName];
            });
        }
        return null;
    }
    
    
    /**
     * remove a file from the project
     * @param path
     */
    function removeFile(fileName: string) {
        if (projectFilesSet[fileName]) {
            getReferencedOrImportedFiles(fileName).forEach((referencedPath: string) => {
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
    function updateFile(fileName: string) {
        fileSystem.readFile(fileName).then(content => {
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
    function getReferencedOrImportedFiles(fileName: string): string[] {
        if (!projectFilesSet[fileName]) {
            return [];
        }
        var preProcessedFileInfo = ts.preProcessFile(languageServiceHost.getScriptContent(fileName), true),
            dir = path.dirname(fileName);
        
        return preProcessedFileInfo.referencedFiles.map(fileReference => {
            return utils.pathResolve(dir, fileReference.filename);
        }).concat(preProcessedFileInfo.importedFiles.map(fileReference => {
            return utils.pathResolve(dir, fileReference.filename + '.ts');
        }));
    }
    
    /**
     * add a reference 
     * 
     * @param fileName the path of the file referencing anothe file
     * @param referencedPath the path of the file referenced
     */
    function addReference(fileName: string, referencedPath: string) {
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
    function removeReference(fileName: string, referencedPath: string) {
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
    function updateReferences(fileName: string, oldFileReferences: { [key: string]: boolean}) {
        getReferencedOrImportedFiles(fileName).forEach(referencedPath => {
            delete oldFileReferences[referencedPath];
            if (!projectFilesSet[referencedPath]) {
                addFile(referencedPath);
                addReference(fileName, referencedPath);
            }
        });
        
        Object.keys(oldFileReferences).forEach(referencedPath => removeReference(fileName, referencedPath));
    }
    
    
    //-------------------------------
    //  Events Handler
    //-------------------------------
    
    /**
     * handle changes in the fileSystem
     */
    function filesChangeHandler(changeRecords: fs.FileChangeRecord[]) {
        queue.then(() => {
            changeRecords.forEach(record => {
                switch (record.kind) { 
                    case fs.FileChangeKind.ADD:
                        if (isProjectSourceFile(record.fileName) || references[record.fileName]) {
                            addFile(record.fileName);
                        }
                        break;
                    case fs.FileChangeKind.DELETE:
                        if (projectFilesSet[record.fileName]) {
                            removeFile(record.fileName);
                        }
                        break;
                    case fs.FileChangeKind.UPDATE:
                        if (projectFilesSet[record.fileName]) {
                            updateFile(record.fileName);
                        }
                        break;
                }
            });
        });
    };
    
    /**
     * handle changes in the workingSet
     */
    function workingSetChangedHandler(changeRecord:  ws.WorkingSetChangeRecord) {
        queue.then(() => {
            switch (changeRecord.kind) { 
                case ws.WorkingSetChangeKind.ADD:
                    changeRecord.paths.forEach(fileName  => {
                        if (projectFilesSet[fileName]) {
                            languageServiceHost.setScriptIsOpen(fileName, true);
                        }
                    });
                    break;
                case ws.WorkingSetChangeKind.REMOVE:
                    changeRecord.paths.forEach(fileName  => {
                        if (projectFilesSet[fileName]) {
                            languageServiceHost.setScriptIsOpen(fileName, false);
                            updateFile(fileName);
                        }
                    });
                    break;
            }
        });
    };
    
    /**
     * handle document edition
     */
    function documentEditedHandler(record: ws.DocumentChangeRecord) {
        queue.then(() => {
            if (projectFilesSet[record.path]) {
                var mustUpdate: boolean = false,
                    oldPaths = utils.createMap(getReferencedOrImportedFiles(record.path)),
                    lastChange: ws.DocumentChangeDescriptor;
                record.changeList.some(change => {
                    lastChange = change;
                    if (!change.from || !change.to) {
                        mustUpdate = true;
                    } else {
                        var minChar = languageServiceHost.getIndexFromPosition(record.path, change.from),
                            limChar = languageServiceHost.getIndexFromPosition(record.path, change.to);

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
    };
    
     //-------------------------------
    //  public methods
    //-------------------------------
    
    /**
     * Initialize the project an his component
     */
    function init(): Promise<void> {
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
    function update(config: TypeScriptProjectConfig): Promise<void> {
        
        if (config.typescriptPath !== _config.typescriptPath) {
            return init();
        }
        
        if (!_config.noLib && config.noLib) {
            removeFile(libLocation);
        }
        
        var pojectSources = Object.keys(projectFilesSet).filter(fileName => isProjectSourceFile(fileName));
        _config = config;
        return queue.then(() => {
            languageServiceHost.setCompilationSettings(createCompilationSettings());
            var promises: Promise<any>[] = [];
            pojectSources.forEach(fileName => {
                if (!isProjectSourceFile(fileName)) {
                    removeFile(fileName);
                }    
            });
            
            return Promise.all(promises)
                .then(() => collectFiles())
                .then(() => updateWorkingSet());
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
    function getProjectFileKind(fileName: string): ProjectFileKind {
        return !!projectFilesSet[fileName] ?
            (isProjectSourceFile(fileName) ?   ProjectFileKind.SOURCE : ProjectFileKind.REFERENCE) :
            ProjectFileKind.NONE;
    }
    
    
  
    return {
        init: init,
        update: update,
        dispose: dispose,
        getLanguageService: () => languageService,
        getLanguageServiceHost: () => languageServiceHost,
        getProjectFilesSet: () => utils.clone(projectFilesSet),
        getProjectFileKind: getProjectFileKind,
        getTypeScriptInfo: () => typeScriptInfo
    };
}
