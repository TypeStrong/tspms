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
'use strict';
/**
 * enum listing the change kind that occur in a working set
 */
(function (WorkingSetChangeKind) {
    WorkingSetChangeKind[WorkingSetChangeKind["ADD"] = 0] = "ADD";
    WorkingSetChangeKind[WorkingSetChangeKind["REMOVE"] = 1] = "REMOVE";
})(exports.WorkingSetChangeKind || (exports.WorkingSetChangeKind = {}));
var WorkingSetChangeKind = exports.WorkingSetChangeKind;
