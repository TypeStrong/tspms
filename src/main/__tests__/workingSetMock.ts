'use strict';

import ws = require('../workingSet');
import utils = require('../utils');
import promise  = require('../promise');
import Promise  = promise.Promise;

class WorkingSetMock implements ws.IWorkingSet {
    files: string [] = [];
    workingSetChanged = new utils.Signal<ws.WorkingSetChangeRecord>();
    documentEdited = new utils.Signal<ws.DocumentChangeRecord>();
    
    getFiles() {
        return Promise.resolve(this.files);
    }
    
    addFiles(paths: string[]) {
        this.files = this.files.concat(paths);
        this.workingSetChanged.dispatch({
            kind: ws.WorkingSetChangeKind.ADD,
            fileNames: paths
        });
    }
    
    removeFiles(paths: string[]) {
        this.files = this.files.filter(path => paths.indexOf(path) === -1);
        this.workingSetChanged.dispatch({
            kind: ws.WorkingSetChangeKind.REMOVE,
            fileNames: paths
        });
    }
}

export = WorkingSetMock;
