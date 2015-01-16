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
var fs = require('../fileSystem');
var utils = require('../utils');
var Promise = require('bluebird');
var FileSystem = (function () {
    function FileSystem(files) {
        if (files === void 0) { files = {}; }
        this.files = files;
        this.projectFilesChanged = new utils.Signal();
    }
    FileSystem.prototype.getProjectRoot = function () {
        return Promise.cast('/');
    };
    FileSystem.prototype.getProjectFiles = function (forceRefresh) {
        var _this = this;
        return new Promise(function (resolve) {
            resolve(Object.keys(_this.files));
        });
    };
    FileSystem.prototype.readFile = function (fileName) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.files.hasOwnProperty(fileName)) {
                resolve(_this.files[fileName]);
            }
            else {
                reject('Not found');
            }
        });
    };
    FileSystem.prototype.addFile = function (fileName, content) {
        if (this.files.hasOwnProperty(fileName)) {
            throw new Error('File already present');
        }
        this.files[fileName] = content;
        this.projectFilesChanged.dispatch([{
            kind: 0 /* ADD */,
            fileName: fileName
        }]);
    };
    FileSystem.prototype.updateFile = function (fileName, content) {
        if (!this.files.hasOwnProperty(fileName)) {
            throw new Error('File does not exist');
        }
        this.files[fileName] = content;
        this.projectFilesChanged.dispatch([{
            kind: 1 /* UPDATE */,
            fileName: fileName
        }]);
    };
    FileSystem.prototype.removeFile = function (fileName) {
        if (!this.files.hasOwnProperty(fileName)) {
            throw new Error('File does not exist');
        }
        delete this.files[fileName];
        this.projectFilesChanged.dispatch([{
            kind: 2 /* DELETE */,
            fileName: fileName
        }]);
    };
    FileSystem.prototype.setFiles = function (files) {
        this.files = files || {};
    };
    FileSystem.prototype.reset = function () {
        this.projectFilesChanged.dispatch([{
            kind: 3 /* RESET */,
            fileName: null
        }]);
    };
    FileSystem.prototype.dispose = function () {
        this.projectFilesChanged.clear();
    };
    return FileSystem;
})();
module.exports = FileSystem;
