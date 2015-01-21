declare module 'typescript-project-services/lib/fileSystem' {

import Promise = require('typescript-project-services/lib/promise');
import utils = require('typescript-project-services/lib/utils');
import ISignal = utils.ISignal;
/**
 * A simple wrapper over brackets filesystem that provide simple function and
 * typed watcher
 */
export interface IFileSystem {
    /**
     * return a promise resolving to the project root folder path
     */
    getProjectRoot(): Promise<string>;
    /**
     * a signal dispatching fine grained change reflecting the change that happens in the working set
     */
    projectFilesChanged: ISignal<FileChangeRecord[]>;
    /**
     * return a promise that resolve with an array of string containing all the files of the projects
     */
    getProjectFiles(): Promise<string[]>;
    /**
     * read a file, return a promise with that resolve to the file content
     *
     * @param path the file to read
     */
    readFile(path: string): Promise<string>;
}
/**
 * enum representing the kind change possible in the fileSysem
 */
export enum FileChangeKind {
    /**
     * a file has been added
     */
    ADD = 0,
    /**
     * a file has been updated
     */
    UPDATE = 1,
    /**
     * a file has been deleted
     */
    DELETE = 2,
    /**
     * the project files has been reset
     */
    RESET = 3,
}
/**
 * FileSystem change descriptor
 */
export interface FileChangeRecord {
    /**
     * kind of change
     */
    kind: FileChangeKind;
    /**
     * name of the file that have changed
     */
    fileName: string;
}


}

declare module 'typescript-project-services/lib/promise' {

 module Promise {
    interface Thenable<R> {
        then<U>(onFulfilled: (value: R) => Thenable<U>, onRejected: (error: any) => Thenable<U>): Thenable<U>;
        then<U>(onFulfilled: (value: R) => Thenable<U>, onRejected?: (error: any) => U): Thenable<U>;
        then<U>(onFulfilled: (value: R) => U, onRejected: (error: any) => Thenable<U>): Thenable<U>;
        then<U>(onFulfilled?: (value: R) => U, onRejected?: (error: any) => U): Thenable<U>;
    }
}
interface Promise<R> {
    /**
     * onFulFill is called when/if "promise" resolves. onRejected is called when/if "promise" rejects.
     * Both are optional, if either/both are omitted the next onFulfilled/onRejected in the chain is called.
     * Both callbacks have a single parameter , the fulfillment value or rejection reason.
     * "then" returns a new promise equivalent to the value you return from onFulfilled/onRejected after
     * being passed through Promise.resolve.
     * If an error is thrown in the callback, the returned promise rejects with that error.
     *
     * @param onFulFill called when/if "promise" resolves
     * @param onReject called when/if "promise" rejects
     */
    then<U>(onFulfill: (value: R) => Promise.Thenable<U>, onReject: (error: any) => Promise.Thenable<U>): Promise<U>;
    /**
     * onFulFill is called when/if "promise" resolves. onRejected is called when/if "promise" rejects.
     * Both are optional, if either/both are omitted the next onFulfilled/onRejected in the chain is called.
     * Both callbacks have a single parameter , the fulfillment value or rejection reason.
     * "then" returns a new promise equivalent to the value you return from onFulfilled/onRejected after
     * being passed through Promise.resolve.
     * If an error is thrown in the callback, the returned promise rejects with that error.
     *
     * @param onFulFill called when/if "promise" resolves
     * @param onReject called when/if "promise" rejects
     */
    then<U>(onFulfill: (value: R) => Promise.Thenable<U>, onReject?: (error: any) => U): Promise<U>;
    /**
     * onFulFill is called when/if "promise" resolves. onRejected is called when/if "promise" rejects.
     * Both are optional, if either/both are omitted the next onFulfilled/onRejected in the chain is called.
     * Both callbacks have a single parameter , the fulfillment value or rejection reason.
     * "then" returns a new promise equivalent to the value you return from onFulfilled/onRejected after
     * being passed through Promise.resolve.
     * If an error is thrown in the callback, the returned promise rejects with that error.
     *
     * @param onFulFill called when/if "promise" resolves
     * @param onReject called when/if "promise" rejects
     */
    then<U>(onFulfill: (value: R) => U, onReject: (error: any) => Promise.Thenable<U>): Promise<U>;
    /**
     * onFulFill is called when/if "promise" resolves. onRejected is called when/if "promise" rejects.
     * Both are optional, if either/both are omitted the next onFulfilled/onRejected in the chain is called.
     * Both callbacks have a single parameter , the fulfillment value or rejection reason.
     * "then" returns a new promise equivalent to the value you return from onFulfilled/onRejected after
     * being passed through Promise.resolve.
     * If an error is thrown in the callback, the returned promise rejects with that error.
     *
     * @param onFulFill called when/if "promise" resolves
     * @param onReject called when/if "promise" rejects
     */
    then<U>(onFulfill?: (value: R) => U, onReject?: (error: any) => U): Promise<U>;
    /**
     * Sugar for promise.then(undefined, onRejected)
     *
     * @param onReject called when/if "promise" rejects
     */
    catch<U>(onReject?: (error: any) => Promise.Thenable<U>): Promise<U>;
    /**
     * Sugar for promise.then(undefined, onRejected)
     *
     * @param onReject called when/if "promise" rejects
     */
    catch<U>(onReject?: (error: any) => U): Promise<U>;
}
export = Promise;


}

declare module 'typescript-project-services/lib/languageServiceHost' {

import ts = require('typescript');
interface LanguageServiceHost extends ts.LanguageServiceHost {
    /**
     * add a script to the host
     *
     * @param fileName the absolute path of the file
     * @param content the file content
     */
    addScript(fileName: string, content: string): void;
    /**
     * remove a script from the host
     *
     * @param fileName the absolute path of the file
     */
    removeScript(fileName: string): void;
    /**
     * remove all script from the host
     *
     * @param fileName the absolute path of the file
     */
    removeAll(): void;
    /**
     * update a script
     *
     * @param fileName the absolute path of the file
     * @param content the new file content
     */
    updateScript(fileName: string, content: string): void;
    /**
     * edit a script
     *
     * @param fileName the absolute path of the file
     * @param minChar the index in the file content where the edition begins
     * @param limChar the index  in the file content where the edition ends
     * @param newText the text inserted
     */
    editScript(fileName: string, minChar: number, limChar: number, newText: string): void;
    /**
     * set 'open' status of a script
     *
     * @param fileName the absolute path of the file
     * @param isOpen open status
     */
    setScriptIsOpen(fileName: string, isOpen: boolean): void;
    /**
     * the the language service host compilation settings
     *
     * @param the settings to be applied to the host
     */
    setCompilationSettings(settings: ts.CompilerOptions): void;
    /**
     * retrieve the content of a given script
     *
     * @param fileName the absolute path of the file
     */
    getScriptContent(fileName: string): string;
    /**
     * return an index from a positon in line/char
     *
     * @param path the path of the file
     * @param position the position
     */
    getIndexFromPosition(fileName: string, position: {
        ch: number;
        line: number;
    }): number;
    /**
     * return a positon in line/char from an index
     *
     * @param path the path of the file
     * @param index the index
     */
    getPositionFromIndex(fileName: string, index: number): {
        ch: number;
        line: number;
    };
} module LanguageServiceHost {
    function create(baseDir: string, defaultLibFileName: string): LanguageServiceHost;
}
export = LanguageServiceHost;


}

declare module 'typescript-project-services/lib/project' {

import ts = require('typescript');
import Promise = require('typescript-project-services/lib/promise');
import fs = require('typescript-project-services/lib/fileSystem');
import ws = require('typescript-project-services/lib/workingSet');
import LanguageServiceHost = require('typescript-project-services/lib/languageServiceHost');
/**
 * Project Configuration
 */
export interface TypeScriptProjectConfig {
    /**
     * Array of minimatch pattern string representing
     * sources of a project
     */
    sources?: string[];
    /**
     * Path to an alternative typescriptCompiler
     */
    typescriptPath?: string;
    /**
     * should the project include the default typescript library file
     */
    noLib?: boolean;
    /**
     *
     */
    target?: string;
    /**
     * Specify ECMAScript target version: 'ES3' (default), or 'ES5'
     */
    module?: string;
    /**
     * Specifies the location where debugger should locate TypeScript files instead of source locations.
     */
    sourceRoot?: string;
    /**
     *  Warn on expressions and declarations with an implied 'any' type.
     */
    noImplicitAny?: boolean;
}
export interface TypeScriptProject {
    /**
     * Initialize the project an his component
     */
    init(): Promise<void>;
    /**
     * update a project with a new config
     */
    update(config: TypeScriptProjectConfig): Promise<void>;
    /**
     * dispose the project
     */
    dispose(): void;
    /**
     * return the language service host of the project
     */
    getLanguageServiceHost(): LanguageServiceHost;
    /**
     * return the languageService used by the project
     */
    getLanguageService(): ts.LanguageService;
    /**
     * return the typescript info used by the project
     */
    getTypeScriptInfo(): TypeScriptInfo;
    /**
     * return the set of files contained in the project
     */
    getProjectFilesSet(): {
        [path: string]: boolean;
    };
    /**
     * for a given path, give the relation between the project an the associated file
     * @param path
     */
    getProjectFileKind(fileName: string): ProjectFileKind;
}
export enum ProjectFileKind {
    /**
     * the file is not a part of the project
     */
    NONE = 0,
    /**
     * the file is a source file of the project
     */
    SOURCE = 1,
    /**
     * the file is referenced by a source file of the project
     */
    REFERENCE = 2,
}
export type TypeScriptInfo = {
    typeScript: typeof ts;
    libLocation: string;
};
export function createProject(baseDirectory: string, config: TypeScriptProjectConfig, fileSystem: fs.IFileSystem, workingSet: ws.IWorkingSet, defaultLibLocation: string): TypeScriptProject;


}

declare module 'typescript-project-services/lib/projectManager' {

import Promise = require('typescript-project-services/lib/promise');
import fs = require('typescript-project-services/lib/fileSystem');
import ws = require('typescript-project-services/lib/workingSet');
import project = require('typescript-project-services/lib/project');
import TypeScriptProject = project.TypeScriptProject;
import TypeScriptProjectConfig = project.TypeScriptProjectConfig;
export type ProjectManagerConfig = {
    /**
     *  location of the default typescript compiler lib.d.ts file
     */
    defaultTypeScriptLocation: string;
    /**
     * editor filesystem manager
     */
    fileSystem: fs.IFileSystem;
    /**
     * ditor workingset manager
     */
    workingSet: ws.IWorkingSet;
    /**
     * projects configurations
     */
    projectConfigs: {
        [projectId: string]: TypeScriptProjectConfig;
    };
};
/**
 * initialize the project manager
 *
 * @param config ProjectManager configuration
 */
export function init(config: ProjectManagerConfig): Promise<void>;
/**
 * dispose the project manager
 */
export function dispose(): void;
/**
 * this method will try to find a project referencing the given path
 * it will by priority try to retrive project that have that file as part of 'direct source'
 * before returning projects that just have 'reference' to this file
 *
 * @param fileName the path of the typesrcript file for which project are looked fo
 */
export function getProjectForFile(fileName: string): Promise<TypeScriptProject>;
export function updateProjectConfigs(configs: {
    [projectId: string]: TypeScriptProjectConfig;
}): Promise<void>;


}

declare module 'typescript-project-services/lib/utils' {

import Promise = require('typescript-project-services/lib/promise');
import project = require('typescript-project-services/lib/project');
import TypeScriptProjectConfig = project.TypeScriptProjectConfig;
/**
 * A simple Promise Queue
 */
export class PromiseQueue {
    /**
     * the current promise
     */
    private promise;
    /**
     * the resolve function of the initial promise
     */
    private initializer;
    /**
     * true if the queue has been initialized
     */
    private initialized;
    constructor();
    /**
     * initialize the queue subsequent call reset the queue
     *
     * @param val the value passed as initialial result
     */
    init<T>(val: Promise<T>): Promise<T>;
    /**
     * enqueue an action
     */
    then<T>(action: () => Promise<T>): Promise<T>;
    /**
     * enqueue an action
     */
    then<T>(action: () => T): Promise<T>;
}
export function mapValues<T>(map: {
    [index: string]: T;
}): T[];
/**
 * assign all properties of a list of object to an object
 * @param target the object that will receive properties
 * @param items items which properties will be assigned to a target
 */
export function assign(target: any, ...items: any[]): any;
/**
 * clone an object (shallow)
 * @param target the object to clone
 */
export function clone<T>(target: T): T;
export function createMap(arr: string[]): {
    [string: string]: boolean;
};
/**
 * browserify path.resolve is buggy on windows
 */
export function pathResolve(from: string, to: string): string;
/**
 * Default configuration for typescript project
 */
export var typeScriptProjectConfigDefault: TypeScriptProjectConfig;
/**
 * C# like events and delegates for typed events
 * dispatching
 */
export interface ISignal<T> {
    /**
     * Subscribes a listener for the signal.
     *
     * @params listener the callback to call when events are dispatched
     * @params priority an optional priority for this signal
     */
    add(listener: (parameter: T) => any, priority?: number): void;
    /**
     * unsubscribe a listener for the signal
     *
     * @params listener the previously subscribed listener
     */
    remove(listener: (parameter: T) => any): void;
    /**
     * dispatch an event
     *
     * @params parameter the parameter attached to the event dispatching
     */
    dispatch(parameter?: T): boolean;
    /**
     * Remove all listener from the signal
     */
    clear(): void;
    /**
     * @return true if the listener has been subsribed to this signal
     */
    hasListeners(): boolean;
}
export class Signal<T> implements ISignal<T> {
    /**
     * list of listeners that have been suscribed to this signal
     */
    private listeners;
    /**
     * Priorities corresponding to the listeners
     */
    private priorities;
    /**
     * Subscribes a listener for the signal.
     *
     * @params listener the callback to call when events are dispatched
     * @params priority an optional priority for this signal
     */
    add(listener: (parameter: T) => any, priority?: number): void;
    /**
     * unsubscribe a listener for the signal
     *
     * @params listener the previously subscribed listener
     */
    remove(listener: (parameter: T) => any): void;
    /**
     * dispatch an event
     *
     * @params parameter the parameter attached to the event dispatching
     */
    dispatch(parameter?: T): boolean;
    /**
     * Remove all listener from the signal
     */
    clear(): void;
    /**
     * @return true if the listener has been subsribed to this signal
     */
    hasListeners(): boolean;
}
export function binarySearch(array: number[], value: number): number;


}

declare module 'typescript-project-services/lib/workingSet' {

import Promise = require('typescript-project-services/lib/promise');
import utils = require('typescript-project-services/lib/utils');
import ISignal = utils.ISignal;
/**
 * A service that will reflect files in the working set
 */
export interface IWorkingSet {
    /**
     * list of files in the working set
     */
    getFiles(): Promise<string[]>;
    /**
     * a signal dispatching events when change occured in the working set
     */
    workingSetChanged: ISignal<WorkingSetChangeRecord>;
    /**
     * a signal that provide fine grained change over edited document
     */
    documentEdited: ISignal<DocumentChangeRecord>;
}
/**
 * describe change in the working set
 */
export interface WorkingSetChangeRecord {
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
export enum WorkingSetChangeKind {
    ADD = 0,
    REMOVE = 1,
}
/**
 * describe a change in a document
 */
export interface DocumentChangeDescriptor {
    /**
     * start position of the change
     */
    from?: {
        ch: number;
        line: number;
    };
    /**
     * end positon of the change
     */
    to?: {
        ch: number;
        line: number;
    };
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
export interface DocumentChangeRecord {
    /**
     * path of the files that has changed
     */
    path: string;
    /**
     * list of changes
     */
    changeList: DocumentChangeDescriptor[];
    /**
     * documentText
     */
    documentText: string;
}


}

declare module 'typescript-project-services/lib/serviceUtils' {

import ts = require('typescript');
import SourceFile = ts.SourceFile;
import Node = ts.Node;
import SyntaxKind = ts.SyntaxKind;
export function getTouchingWord(sourceFile: SourceFile, position: number, typeScript: typeof ts): Node;
/** Returns the token if position is in [start, end) or if position === end and includeItemAtEndPosition(token) === true */
export function getTouchingToken(sourceFile: SourceFile, position: number, typeScript: typeof ts, includeItemAtEndPosition?: (n: Node) => boolean): Node;
export function getSynTaxKind(type: string, typescript: typeof ts): any;
export function findPrecedingToken(position: number, sourceFile: SourceFile, typeScript: typeof ts, startNode?: Node): Node;
export function nodeHasTokens(n: Node): boolean;
export function isToken(n: Node, typeScript: typeof ts): boolean;
export function isWord(kind: SyntaxKind, typeScript: typeof ts): boolean;
export function isKeyword(token: SyntaxKind, typeScript: typeof ts): boolean;


}

declare module 'typescript-project-services' {

import ts = require('typescript');
import Promise = require('typescript-project-services/lib/promise');
import ProjectManager = require('typescript-project-services/lib/projectManager');
import project = require('typescript-project-services/lib/project');
export type Position = {
    line: number;
    ch: number;
};
export function init(config: ProjectManager.ProjectManagerConfig): Promise<void>;
export function updateProjectConfigs(configs: {
    [projectId: string]: project.TypeScriptProjectConfig;
}): Promise<void>;
export function dispose(): void;
/**
 * Represent definition info of a symbol
 */
export interface DefinitionInfo {
    /**
     * full name of the symbol
     */
    name: string;
    /**
     * line at which the symbol definition start
     */
    lineStart: number;
    /**
     * charachter at which the symbol definition start
     */
    charStart: number;
    /**
     * line at which the symbol definition end
     */
    lineEnd: number;
    /**
     * charachter at which the symbol definition end
     */
    charEnd: number;
    /**
     * path of the file where the symbol is defined
     */
    fileName: string;
}
/**
 * retrieve definition info of a symbol at a given position in a given file
 * @param fileName the absolute path of the file
 * @param position in the file where you want to retrieve definition info
 *
 * @return a promise resolving to a list of definition info
 */
export function getDefinitionAtPosition(fileName: string, position: Position): Promise<DefinitionInfo[]>;
export enum DiagnosticCategory {
    Warning = 0,
    Error = 1,
    Message = 2,
}
export interface TSError {
    pos: Position;
    endPos: Position;
    message: string;
    type: DiagnosticCategory;
}
/**
 * Retrieve a list of errors for a given file
 * @param fileName the absolute path of the file
 *
 * @return a promise resolving to a list of errors
 */
export function getErrorsForFile(fileName: string): Promise<TSError[]>;
export interface TextEdit {
    start: number;
    end: number;
    newText: string;
}
/**
 * Retrieve formating information for a givent file
 * @param fileName the absolute path of the file
 * @param options formation options
 * @param startPos an option start position for the formating range
 * @param endPos an optional end position for the formating range
 *
 * @return a promise resolving to a formating range info
 */
export function getFormatingForFile(fileName: string, options: ts.FormatCodeOptions, startPos?: Position, endPos?: Position): Promise<TextEdit[]>;
/**
 * Represent a completion result
 */
export interface CompletionResult {
    /**
     * the matched string portion
     */
    match: string;
    /**
     * list of proposed entries for code completion
     */
    entries: ts.CompletionEntryDetails[];
}
/**
 * Retrieve completion proposal at a given point in a given file
 * @param fileName the absolute path of the file
 * @param position in the file where you want to retrieve completion proposal
 *
 * @return a promise resolving to a list of proposals
 */
export function getCompletionAtPosition(fileName: string, position: Position, limit?: number, skip?: number): Promise<CompletionResult>;


}
