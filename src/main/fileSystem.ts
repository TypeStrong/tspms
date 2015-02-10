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
 * Interface abstracting file system to provide adapter to the service.
 */
export interface IFileSystem {
    
    /**
     * Return a promise resolving to the project root folder path.
     */
    getProjectRoot(): promise.Promise<string>;
    
    /**
     * A signal dispatching change in files under the project root directory.
     */
    projectFilesChanged: ISignal<FileChangeRecord[]>;
    
    /**
     * Return a promise that resolve to an array of string containing all the typescript files name in the projects.
     */
    getProjectFiles(): promise.Promise<string[]>;
    
    /**
     * Read a file, return a promise that resolve to the file content.
     * 
     * @param fileName the name of file to read.
     */
    readFile(fileName: string): promise.Promise<string>;
}

//--------------------------------------------------------------------------
//
//  Change record
//
//--------------------------------------------------------------------------

/**
 * An Enum representing the kind of change that migth occur in the fileSysem.
 */
export const enum FileChangeKind {
    /**
     * A file has been added.
     */
    ADD,
    
    /**
     * A file has been updated.
     */
    UPDATE,
    
    /**
     * A file has been deleted.
     */
    DELETE,
    
    /**
     * The project files has been refreshed.
     */
    RESET
}

/**
 * FileSystem change descriptor.
 */
export type FileChangeRecord = {
    /**
     * kind of change.
     */
    kind: FileChangeKind;
    
    /**
     * The name of the file that have changed if any.
     */
    fileName?: string;
}
