'use strict';

import fs       = require('../fileSystem');
import utils    = require('../utils')
import promise  = require('../promise');
import Promise  = promise.Promise;

class FileSystem implements fs.IFileSystem {
    
    constructor( 
        private files: { [fileName: string]: string } = {}
    ) {}
    
    
    getProjectRoot() {
        return Promise.resolve('/');
    }
    
    getProjectFiles(forceRefresh?: boolean): Promise<string[]> {
        return new Promise(resolve => {
            resolve(Object.keys(this.files));
        });
    }
    
    readFile(fileName: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.files.hasOwnProperty(fileName)) {
                resolve(this.files[fileName]);
            } else {
                reject('Not found');
            } 
        });
    }
    
    projectFilesChanged = new utils.Signal<fs.FileChangeRecord[]>();
    
    addFile(fileName: string, content: string) {
        if (this.files.hasOwnProperty(fileName)) {
            throw new Error('File already present');
        }
        this.files[fileName] = content;
        this.projectFilesChanged.dispatch([{
            kind : fs.FileChangeKind.ADD,
            fileName: fileName
        }]);
    } 
    
    updateFile(fileName: string, content: string) {
        if (!this.files.hasOwnProperty(fileName)) {
            throw new Error('File does not exist');
        }
        this.files[fileName] = content;
        this.projectFilesChanged.dispatch([{
            kind : fs.FileChangeKind.UPDATE,
            fileName: fileName
        }]);
    } 
    
    removeFile(fileName: string) {
        if (!this.files.hasOwnProperty(fileName)) {
            throw new Error('File does not exist');
        }
        delete this.files[fileName];
        this.projectFilesChanged.dispatch([{
            kind : fs.FileChangeKind.DELETE,
            fileName: fileName
        }]);
    }
    
    setFiles(files: { [fileName: string]: string }) {
        this.files = files || {};
    }
    
    reset(): void {
        this.projectFilesChanged.dispatch([{
            kind : fs.FileChangeKind.RESET,
            fileName: null
        }]);
    }
    
    
    dispose(): void {
        this.projectFilesChanged.clear();
    }
}



export = FileSystem;