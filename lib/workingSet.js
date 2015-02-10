'use strict';
/**
 * An Enum listing the kind of change that might occur in the working set.
 */
(function (WorkingSetChangeKind) {
    /**
     * A file has been added to the working set.
     */
    WorkingSetChangeKind[WorkingSetChangeKind["ADD"] = 0] = "ADD";
    /**
     * A file has been removed from the working set.
     */
    WorkingSetChangeKind[WorkingSetChangeKind["REMOVE"] = 1] = "REMOVE";
})(exports.WorkingSetChangeKind || (exports.WorkingSetChangeKind = {}));
var WorkingSetChangeKind = exports.WorkingSetChangeKind;
