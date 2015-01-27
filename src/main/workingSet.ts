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
 * A service that will reflect files in the working set 
 */
export interface IWorkingSet {
    /**
     * list of files in the working set
     */
    getFiles(): promise.Promise<string[]>;
    
    /**
     * a signal dispatching events when change occured in the working set
     */
    workingSetChanged: ISignal<WorkingSetChangeRecord>;
    
    /**
     * a signal that provide fine grained change over edited document
     */
    documentEdited: ISignal<DocumentChangeRecord>;
}


//--------------------------------------------------------------------------
//
//  ChangeRecord
//
//--------------------------------------------------------------------------


/**
 * describe change in the working set
 */
export type WorkingSetChangeRecord = {
    /**
     * kind of change that occured in the working set
     */
    kind: WorkingSetChangeKind;
    
    /**
     * list of paths that has been added or removed from the working set
     */
    paths: string[];
}


/**
 * enum listing the change kind that occur in a working set
 */
export const enum WorkingSetChangeKind {
    ADD,
    REMOVE
}


//--------------------------------------------------------------------------
//
//  DocumentChangeDescriptor
//
//--------------------------------------------------------------------------

/**
 * describe a change in a document
 */
export type DocumentChangeDescriptor = {
    
    /**
     * start position of the change
     */
    from?: number;
    
    /**
     * end positon of the change
     */
    to?: number;
    
    /**
     * text that has been inserted (if any)
     */
    text?: string;
    
    /**
     * text that has been removed (if any)
     */
    removed?: string;
    
}

/**
 * describe a list of change in a document
 */
export type DocumentChangeRecord = {
    /**
     * path of the files that has changed
     */
    path: string;
    /**
     * list of changes
     */
    changeList?: DocumentChangeDescriptor[];
    
    /**
     * documentText
     */
    documentText?: string
}