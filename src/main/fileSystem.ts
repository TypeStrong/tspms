'use strict';

import promise = require('./promise');
import utils = require('./utils');
import ISignal = utils.ISignal;


//--------------------------------------------------------------------------
//
//  IFileSystem
//
//--------------------------------------------------------------------------

/**
 * A simple wrapper over brackets filesystem that provide simple function and 
 * typed watcher
 */
export interface IFileSystem {
    
    /**
     * return a promise resolving to the project root folder path
     */
    getProjectRoot(): promise.Promise<string>;
    
    /**
     * a signal dispatching fine grained change reflecting the change that happens in the working set
     */
    projectFilesChanged: ISignal<FileChangeRecord[]>;
    
    /**
     * return a promise that resolve with an array of string containing all the files of the projects
     */
    getProjectFiles(): promise.Promise<string[]>;
    
    /**
     * read a file, return a promise with that resolve to the file content
     * 
     * @param path the file to read
     */
    readFile(path: string): promise.Promise<string>;
}


//--------------------------------------------------------------------------
//
//  Change record
//
//--------------------------------------------------------------------------


/**
 * enum representing the kind change possible in the fileSysem
 */
export const enum FileChangeKind {
    /**
     * a file has been added
     */
    ADD,
    
    /**
     * a file has been updated
     */
    UPDATE,
    
    /**
     * a file has been deleted
     */
    DELETE,
    
    /**
     * the project files has been reset 
     */
    RESET
}

/**
 * FileSystem change descriptor
 */
export type FileChangeRecord = {
    /**
     * kind of change
     */
    kind: FileChangeKind;
    
    /**
     * name of the file that have changed
     */
    fileName: string;
}