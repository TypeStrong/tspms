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
//--------------------------------------------------------------------------
//
//  Change record
//
//--------------------------------------------------------------------------
/**
 * enum representing the kind change possible in the fileSysem
 */
(function (FileChangeKind) {
    /**
     * a file has been added
     */
    FileChangeKind[FileChangeKind["ADD"] = 0] = "ADD";
    /**
     * a file has been updated
     */
    FileChangeKind[FileChangeKind["UPDATE"] = 1] = "UPDATE";
    /**
     * a file has been deleted
     */
    FileChangeKind[FileChangeKind["DELETE"] = 2] = "DELETE";
    /**
     * the project files has been reset
     */
    FileChangeKind[FileChangeKind["RESET"] = 3] = "RESET";
})(exports.FileChangeKind || (exports.FileChangeKind = {}));
var FileChangeKind = exports.FileChangeKind;
