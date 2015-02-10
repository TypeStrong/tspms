'use strict';

import ts = require('typescript');
import path = require('path');
import promise = require('./promise');
import fs = require('./fileSystem');
import ws = require('./workingSet');
import utils = require('./utils');
import Logger = require('./logger');
import LanguageServiceHost = require('./languageServiceHost');
import CompilerManager = require('./compilerManager');

import TypeScriptInfo = CompilerManager.TypeScriptInfo;
import Map = utils.Map;
import Set = utils.Set;

//--------------------------------------------------------------------------
//
//  Type Definitions
//
//--------------------------------------------------------------------------

/**
 * Project Configuration.
 */
export type TypeScriptProjectConfig = {
    /**
     * Patterns used for glob matching sources file of the project
     */
    sources: string[] | string;
    
    /**
     * Compiler options
     */
    compilerOptions: ts.CompilerOptions;
        
    /**
     * Absolute path of the compiler directory
     */
    compilerDirectory?: string;
}

/**
 * A TypeScript project is responsible of managing an instance of LanguageService and LanguageServiceHost, 
 * and expose those instance.
 * It will extract files and compiler options for a given configuration and feed the LanguageServiceHost accordingly.
 */
export interface TypeScriptProject {
    
    /**
     * Initialize the project.
     */
    init(): promise.Promise<void>;

    /**
     * Update a project accordingly to a new configuration.
     * 
     * @param config the new project configuration.
     */
    update(config: TypeScriptProjectConfig): promise.Promise<void>;
    
    /**
     * Dispose the project.
     */
    dispose():void

    /**
     * Exposes the LanguageServiceHost instance managed by the project.
     */
    getLanguageServiceHost(): LanguageServiceHost;
    
    /**
     * Exposes the LanguageService instance managed by the project.
     */
    getLanguageService(): ts.LanguageService;
    
    /**
     * Exposes the typescript information used by the project.
     */
    getTypeScriptInfo(): TypeScriptInfo;
    
    /**
     * The set of files in the project sources.
     */
    getProjectFilesSet(): Set;
    
    /**
     * For a given file, give the relation between the project an the associated file.
     * 
     * @param fileName the absolute file name of the file.
     */
    getProjectFileKind(fileName: string): ProjectFileKind;
}

/**
 * Describe the relation between a file and a project
 */
export const enum ProjectFileKind {
    /**
     * The file is not a part of the project.
     */
    NONE,
    /**
     * The file is a source file of the project.
     */
    SOURCE,
    /**
     * The file is referenced by a source file of the project.
     */
    REFERENCE
}

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
export function createProject(
    currentDir: string, 
    config: TypeScriptProjectConfig, 
    fileSystem: fs.IFileSystem, 
    workingSet: ws.IWorkingSet): TypeScriptProject {
    
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
    var languageServiceHost: LanguageServiceHost;
    
    /**
     * The LanguageService instance managed by this project.
     */
    var languageService: ts.LanguageService;
    
    /**
     * The set of files composing the project.
     */
    var projectFilesSet: Set;
    
    /**
     * A map of set describing references between projects Files
     */
    var references: Map<Set>;
    
    /**
     * A promise queue used to insure that fileSystem operaion are run in sequence.
     */
    var queue = utils.createPromiseQueue()
    
    /**
     * Compiler information for the typescript compiler used by the project.
     */
    var typeScriptInfo: TypeScriptInfo;
    
    
    //-------------------------------
    //  Project Files Management
    //-------------------------------
    
    /**
     * Update the languageService host script 'open' status according to file in the working set.
     */
    function updateWorkingSet() {
        workingSet.getFiles().then(files => files.forEach(fileName => {
            if (projectFilesSet[fileName]) {
                languageServiceHost.setScriptIsOpen(fileName, true);
            }
        }));
    }
    
    /**
     * Retrieves the files content for path matching the config sources patterns.
     */
    function collectFiles(): promise.Promise<any> { 
        return fileSystem.getProjectFiles().then(files => {
            var promises: promise.Promise<any>[] = [];
            files.forEach(fileName => {
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
    function isProjectSourceFile(fileName: string): boolean {
        return utils.match(currentDir, fileName, _config.sources);
    }
    
    /**
     * Add a file to the project and all references of this file.
     * 
     * @param fileName the absolute file name.
     */
    function addFile(fileName: string): promise.Promise<any>  {
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
     * Remove a file from the project, and all references that are not referenced by another file.
     * 
     * @param fileName the absolute file name.
     */
    function removeFile(fileName: string) {
        if (projectFilesSet[fileName]) {
            getReferencedOrImportedFiles(fileName).forEach((referencedFileName: string) => {
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
    function updateFile(fileName: string) {
        fileSystem.readFile(fileName).then(content => {
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
    function getReferencedOrImportedFiles(fileName: string): string[] {
        if (!projectFilesSet[fileName]) {
            return [];
        }
        var preProcessedFileInfo = ts.preProcessFile(languageServiceHost.getScriptContent(fileName), true);
        var dir = path.dirname(fileName);
        
        return preProcessedFileInfo.referencedFiles.map(fileReference => {
            return utils.pathResolve(dir, fileReference.filename);
        }).concat(preProcessedFileInfo.importedFiles.map(fileReference => {
            return utils.pathResolve(dir, fileReference.filename + '.ts');
        }));
    }
    
    /**
     * Add a reference.
     * 
     * @param fileName the absolute fileName of the file referencing another file.
     * @param referencedFileName the absolute fileName of the file referenced.
     */
    function addReference(fileName: string, referencedFileName: string) {
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
    function removeReference(fileName: string, referencedFileName: string) {
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
    function updateReferences(fileName: string, oldFileReferences: Set) {
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
     * Handle changes in the file system.
     * 
     * @param changeRecords file system changes descriptors.
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
                        } else if (record.fileName === typeScriptInfo.servicesFileName) {
                            languageService.dispose();
                            return init();
                        }
                        break;
                }
            });
        });
    };
    
    /**
     * Handle changes in the working set.
     * 
     * @param changeRecord working set change descriptor.
     */
    function workingSetChangedHandler(changeRecord:  ws.WorkingSetChangeRecord) {
        queue.then(() => {
            switch (changeRecord.kind) { 
                case ws.WorkingSetChangeKind.ADD:
                    changeRecord.fileNames.forEach(fileName  => {
                        if (projectFilesSet[fileName]) {
                            languageServiceHost.setScriptIsOpen(fileName, true);
                        }
                    });
                    break;
                case ws.WorkingSetChangeKind.REMOVE:
                    changeRecord.fileNames.forEach(fileName  => {
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
     * Handle document edition.
     * 
     * @param record edition descriptor.
     */
    function documentEditedHandler(record: ws.DocumentChangeRecord) {
        queue.then(() => {
            if (projectFilesSet[record.fileName]) {
                var oldPaths = utils.arrayToSet(getReferencedOrImportedFiles(record.fileName));
                if (record.documentText) {
                    languageServiceHost.updateScript(record.fileName, record.documentText);
                } else {
                    record.changeList.forEach(change => {
                        languageServiceHost.editScript(record.fileName, change.from, change.to, change.text);
                    });
                }
                updateReferences(record.fileName, oldPaths);
            }
        });
    };
    
    //--------------------------------------------------------------------------
    //
    //  Public API
    //
    //--------------------------------------------------------------------------
    
    /**
     * Initialize the project.
     */
    function init(): promise.Promise<void> {
        projectFilesSet = Object.create(null);
        references = Object.create(null);
        workingSet.workingSetChanged.add(workingSetChangedHandler);
        workingSet.documentEdited.add(documentEditedHandler);
        fileSystem.projectFilesChanged.add(filesChangeHandler);
        
        var compilerDirectory = _config.compilerDirectory;
        return queue.reset(
            new promise.Promise<TypeScriptInfo>((resolve, reject) => {
                if (!compilerDirectory) {
                    resolve(CompilerManager.getDefaultTypeScriptInfo())
                } else {
                    resolve(
                        CompilerManager
                        .acquireCompiler(_config.compilerDirectory)
                        .catch(e => {
                            //TODO instead of silently returning default we should handle this error in project
                            //manager and return an error in the linter
                            Logger.warn('could not retrieve typescript compiler at path: ' + compilerDirectory);
                            return CompilerManager.getDefaultTypeScriptInfo();
                        })
                    );
                } 
            })
            .then(info =>  {
                typeScriptInfo = info;
                languageServiceHost = LanguageServiceHost.create(currentDir, typeScriptInfo.defaultLibFileName);
                languageServiceHost.setCompilationSettings(utils.clone(_config.compilerOptions));
                languageService = 
                    typeScriptInfo.ts.createLanguageService(languageServiceHost, info.documentRegistry);

                return collectFiles().then(updateWorkingSet);
            })
        );
    }
    
    /**
     * Update a project accordingly to a new configuration.
     * 
     * @param config the new project configuration.
     */
    function update(config: TypeScriptProjectConfig): promise.Promise<void> {
        if (config.compilerDirectory !== _config.compilerDirectory) {
            CompilerManager.releaseCompiler(typeScriptInfo);
            languageService.dispose();
            return init();
        }
        
        if (!_config.compilerOptions.noLib && config.compilerOptions.noLib) {
            removeFile(typeScriptInfo.defaultLibFileName);
        }
        languageService.cleanupSemanticCache();
        
        var pojectSources = Object.keys(projectFilesSet).filter(fileName => isProjectSourceFile(fileName));
        _config = config;
        return queue.then(() => {
            languageServiceHost.setCompilationSettings(_config.compilerOptions);
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
    function getProjectFileKind(fileName: string): ProjectFileKind {
        return !!projectFilesSet[fileName] ?
            (isProjectSourceFile(fileName) ? ProjectFileKind.SOURCE : ProjectFileKind.REFERENCE) :
            ProjectFileKind.NONE;
    }
  
    return {
        init,
        update,
        dispose,
        getProjectFileKind,
        getLanguageService: () => languageService,
        getLanguageServiceHost: () => languageServiceHost,
        getProjectFilesSet: () => utils.clone(projectFilesSet),
        getTypeScriptInfo: () => typeScriptInfo
    };
}
