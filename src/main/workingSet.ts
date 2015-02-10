'use strict';

import promise = require('./promise');
import utils = require('./utils');

import ISignal = utils.ISignal;

//--------------------------------------------------------------------------
//
//  IWorkingSet
//
//--------------------------------------------------------------------------

/**
 * A service that will reflect files in the working set of the editor.
 */
export interface IWorkingSet {
    /**
     * The list of files open in the working set.
     */
    getFiles(): promise.Promise<string[]>;
    
    /**
     * A signal dispatching events when change occured in the working set.
     */
    workingSetChanged: ISignal<WorkingSetChangeRecord>;
    
    /**
     * A signal that provide fine grained change descriptor over edited documents.
     */
    documentEdited: ISignal<DocumentChangeRecord>;
}

//--------------------------------------------------------------------------
//
//  ChangeRecord
//
//--------------------------------------------------------------------------

/**
 * Describe a change in the working set.
 */
export type WorkingSetChangeRecord = {
    /**
     * The kind of change that occured in the working set.
     */
    kind: WorkingSetChangeKind;
    
    /**
     * The list of paths that has been added or removed from the working set.
     */
    fileNames: string[];
}

/**
 * An Enum listing the kind of change that might occur in the working set.
 */
export const enum WorkingSetChangeKind {
    /**
     * A file has been added to the working set.
     */
    ADD,
    
    /**
     * A file has been removed from the working set.
     */
    REMOVE
}

//--------------------------------------------------------------------------
//
//  DocumentChangeDescriptor
//
//--------------------------------------------------------------------------

/**
 * Describe a change in a document.
 */
export type DocumentChangeDescriptor = {
    
    /**
     * Start position of the change.
     */
    from?: number;
    
    /**
     * End positon of the change.
     */
    to?: number;
    
    /**
     * The text that has been inserted (if any).
     */
    text?: string;
    
    /**
     * The text that has been removed (if any).
     */
    removed?: string;

}

/**
 * Describe a list of changes in a document.
 * You can provided either a `changeList` containing a description of all edition in the document, 
 * or documentText providing the new document text. 
 * If  the first method is used (`changeList`) the compiler will be able to use incremental compilation.
 */
export type DocumentChangeRecord = {
    /**
     * absolute file name of the files that has changed.
     */
    fileName: string;
    
    /**
     * The list of changes that occured in the file.
     */
    changeList?: DocumentChangeDescriptor[];
    
    /**
     * The new text of the file.
     */
    documentText?: string
}
