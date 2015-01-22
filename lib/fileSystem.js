'use strict';
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
