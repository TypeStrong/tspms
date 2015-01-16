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
var ws = require('../workingSet');
var utils = require('../utils');
var Promise = require('bluebird');
var WorkingSetMock = (function () {
    function WorkingSetMock() {
        this.files = [];
        this.workingSetChanged = new utils.Signal();
        this.documentEdited = new utils.Signal();
    }
    WorkingSetMock.prototype.getFiles = function () {
        return Promise.cast(this.files);
    };
    WorkingSetMock.prototype.addFiles = function (paths) {
        this.files = this.files.concat(paths);
        this.workingSetChanged.dispatch({
            kind: 0 /* ADD */,
            paths: paths
        });
    };
    WorkingSetMock.prototype.removeFiles = function (paths) {
        this.files = this.files.filter(function (path) { return paths.indexOf(path) === -1; });
        this.workingSetChanged.dispatch({
            kind: 1 /* REMOVE */,
            paths: paths
        });
    };
    return WorkingSetMock;
})();
module.exports = WorkingSetMock;
