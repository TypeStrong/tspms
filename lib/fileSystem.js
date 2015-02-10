'use strict';
//--------------------------------------------------------------------------
//
//  Change record
//
//--------------------------------------------------------------------------
/**
 * An Enum representing the kind of change that migth occur in the fileSysem.
 */
(function (FileChangeKind) {
    /**
     * A file has been added.
     */
    FileChangeKind[FileChangeKind["ADD"] = 0] = "ADD";
    /**
     * A file has been updated.
     */
    FileChangeKind[FileChangeKind["UPDATE"] = 1] = "UPDATE";
    /**
     * A file has been deleted.
     */
    FileChangeKind[FileChangeKind["DELETE"] = 2] = "DELETE";
    /**
     * The project files has been refreshed.
     */
    FileChangeKind[FileChangeKind["RESET"] = 3] = "RESET";
})(exports.FileChangeKind || (exports.FileChangeKind = {}));
var FileChangeKind = exports.FileChangeKind;
