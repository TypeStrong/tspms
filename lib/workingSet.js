'use strict';
/**
 * enum listing the change kind that occur in a working set
 */
(function (WorkingSetChangeKind) {
    WorkingSetChangeKind[WorkingSetChangeKind["ADD"] = 0] = "ADD";
    WorkingSetChangeKind[WorkingSetChangeKind["REMOVE"] = 1] = "REMOVE";
})(exports.WorkingSetChangeKind || (exports.WorkingSetChangeKind = {}));
var WorkingSetChangeKind = exports.WorkingSetChangeKind;
