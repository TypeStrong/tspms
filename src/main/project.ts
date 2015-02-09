'use strict';

import ts                   = require('typescript');
import path                 = require('path');
import promise              = require('./promise');
import fs                   = require('./fileSystem');
import ws                   = require('./workingSet');
import utils                = require('./utils');
import console              = require('./logger');
import LanguageServiceHost  = require('./languageServiceHost');
import compilerManager      = require('./compilerManager');
import TypeScriptInfo       = compilerManager.TypeScriptInfo;

//--------------------------------------------------------------------------
//
//  TypeScriptProject
//
//--------------------------------------------------------------------------

/**
 * Project Configuration
 */
export type TypeScriptProjectConfig = {
    
    /**
     * Array of minimatch pattern string representing 
     * sources of a project
     */
    sources: string[] | string;
    
    /**
     * Compiltation settings
     */
    compilationSettings: ts.CompilerOptions;
        
    /**
     * Path to an alternative typescriptCompiler
     */
    typescriptPath?: string;
    
}

export interface TypeScriptProject {
    
    //-------------------------------
    //  public methods
    //-------------------------------
    
    /**
     * Initialize the project an his component
     */
    init(): promise.Promise<void>;

    
    /**
     * update a project with a new config
     */
    update(config: TypeScriptProjectConfig): promise.Promise<void>;
    
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


export const enum ProjectFileKind {
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





export function createProject(
    baseDirectory: string, 
    config: TypeScriptProjectConfig, 
    fileSystem: fs.IFileSystem, 
    workingSet: ws.IWorkingSet): TypeScriptProject {
    
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
    var queue = utils.createPromiseQueue()
    
       
    /**
     * info for the curently use typescript compiler
     */
    var typeScriptInfo: TypeScriptInfo;
    
    
    
    
    
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
    function collectFiles(): promise.Promise<any> { 
        return fileSystem.getProjectFiles().then(files => {
            var promises: promise.Promise<any>[] = [];
            files.forEach(fileName => {
                if (isProjectSourceFile(fileName) && !projectFilesSet[fileName]) {
                    promises.push(addFile(fileName, false));
                }
            });
            
            if (!_config.compilationSettings.noLib && !projectFilesSet[typeScriptInfo.defaultLibFileName]) {
                promises.push(addFile(typeScriptInfo.defaultLibFileName));
            }
            
            return promise.Promise.all(promises);
        });
    }
    
    /**
     * return true a if a given file path match the config
     * @param path
     */
    function isProjectSourceFile(fileName: string): boolean {
        return utils.match(baseDirectory, fileName, _config.sources);
    }
    
   
    /**
     * add a file to the project and all file that this file reference
     * @param path
     */
    function addFile(fileName: string, notify = true): promise.Promise<any>  {
        if (!projectFilesSet[fileName]) {
            projectFilesSet[fileName] = true;
            return fileSystem.readFile(fileName).then(content => {
                var promises: promise.Promise<any>[] = [];
                languageServiceHost.addScript(fileName, content);
                getReferencedOrImportedFiles(fileName).forEach(referencedFile => {
                    promises.push(addFile(referencedFile));
                    addReference(fileName, referencedFile);
                });
                return promise.Promise.all(promises);
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
                var oldPaths = utils.createMap(getReferencedOrImportedFiles(record.path));
                if (record.documentText) {
                    languageServiceHost.updateScript(record.path, record.documentText);
                } else {
                    record.changeList.forEach(change => {
                        languageServiceHost.editScript(record.path, change.from, change.to, change.text);
                    });
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
    function init(): promise.Promise<void> {
        projectFilesSet = Object.create(null);
        references = Object.create(null);
        workingSet.workingSetChanged.add(workingSetChangedHandler);
        workingSet.documentEdited.add(documentEditedHandler);
        fileSystem.projectFilesChanged.add(filesChangeHandler);
        
        var typescriptPath = _config.typescriptPath;
        return queue.reset(
            new promise.Promise<TypeScriptInfo>((resolve, reject) => {
                if (!typescriptPath) {
                    resolve(compilerManager.getDefaultTypeScriptInfo())
                } else {
                    resolve(
                        compilerManager
                        .acquireCompiler(_config.typescriptPath)
                        .catch(e => {
                            //TODO instead of silently returning default we should handle this error in project
                            //manager and return an error in the linter
                            console.warn('could not retrieve typescript compiler at path: ' + typescriptPath);
                            return compilerManager.getDefaultTypeScriptInfo();
                        })
                    );
                } 
            })
            .then(info =>  {
                typeScriptInfo = info;
                languageServiceHost = LanguageServiceHost.create(baseDirectory, typeScriptInfo.defaultLibFileName);
                languageServiceHost.setCompilationSettings(utils.clone(_config.compilationSettings));
                languageService = 
                    typeScriptInfo.ts.createLanguageService(languageServiceHost, info.documentRegistry);

                return collectFiles().then(updateWorkingSet);
            })
        );
    }
    
    /**
     * update a project with a new config
     */
    function update(config: TypeScriptProjectConfig): promise.Promise<void> {
        
        if (config.typescriptPath !== _config.typescriptPath) {
            languageService.dispose();
            return init();
        }
        languageService.cleanupSemanticCache();
        
        if (!_config.compilationSettings.noLib && config.compilationSettings.noLib) {
            removeFile(typeScriptInfo.defaultLibFileName);
        }
        
        var pojectSources = Object.keys(projectFilesSet).filter(fileName => isProjectSourceFile(fileName));
        _config = config;
        return queue.then(() => {
            languageServiceHost.setCompilationSettings(_config.compilationSettings);
            var promises: promise.Promise<any>[] = [];
            pojectSources.forEach(fileName => {
                if (!isProjectSourceFile(fileName)) {
                    removeFile(fileName);
                }    
            });
            
            return promise.Promise.all(promises)
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
        compilerManager.releaseCompiler(typeScriptInfo);
        languageService.dispose();
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
