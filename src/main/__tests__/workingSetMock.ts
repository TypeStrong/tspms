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

/*istanbulify ignore file*/

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
            paths: paths
        });
    }
    
    
    removeFiles(paths: string[]) {
        this.files = this.files.filter(path => paths.indexOf(path) === -1);
        this.workingSetChanged.dispatch({
            kind: ws.WorkingSetChangeKind.REMOVE,
            paths: paths
        });
    }
}

export = WorkingSetMock;