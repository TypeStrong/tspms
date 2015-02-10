declare module 'typescript-project-services/lib/compilerManager' {

import ts = require('typescript');
import fs = require('typescript-project-services/lib/fileSystem');
import promise = require('typescript-project-services/lib/promise');
/**
 * @module CompilerManager
 *
 * This module manage the different compiler version used by the services.
 * For a given path it will `instanciate`  a `ts` module for a given compiler
 * and release it when no project use it anymore.
 */
/**
 * Informations used by project to use a given version of the typescript compiler
 */
export type TypeScriptInfo = {
    /**
     * compiler `ts` module instance
     */
    ts: typeof ts;
    /**
     * Absolute path of the compiler directory
     */
    compilerDirectory: string;
    /**
     * The name of the `typescriptServices.js` file associated to the compiler
     */
    servicesFileName: string;
    /**
     * absolute filename of the `lib.d.ts` file associated with the compiler
     */
    defaultLibFileName: string;
    /**
     * TypeScript DocumentRegistry shared by projects using the same version of the compiler
     */
    documentRegistry: ts.DocumentRegistry;
};
/**
 * Initialialize the CompilerManager module.
 *
 * @param fs the fileSystem the compilerManager
 */
export function init(fs: fs.IFileSystem, defaultLibFileName: string): void;
/**
 * Retrieve information related to the `default` compiler bundled with the service.
 */
export function getDefaultTypeScriptInfo(): TypeScriptInfo;
/**
 * Acquire typescript information for the given path.
 *
 * @param compilerDirectory the directory of the compiler
 */
export function acquireCompiler(compilerDirectory: string): promise.Promise<TypeScriptInfo>;
/**
 * Release typescriptInfo acquired through this manager.
 *
 * @param typeScriptInfo the `TypeScriptInfo` object acquired throuh this manager
 */
export function releaseCompiler(typeScriptInfo: TypeScriptInfo): void;
/**
 * Dispose the CompilerManager module.
 */
export function dispose(): void;


}

declare module 'typescript-project-services/lib/fileSystem' {

import promise = require('typescript-project-services/lib/promise');
import utils = require('typescript-project-services/lib/utils');
import ISignal = utils.ISignal;
/**
 * Interface abstracting file system to provide adapter to the service.
 */
export interface IFileSystem {
    /**
     * Return a promise resolving to the current directory opened in the editor.
     */
    getCurrentDir(): promise.Promise<string>;
    /**
     * A signal dispatching change in files under the current directory.
     */
    projectFilesChanged: ISignal<FileChangeRecord[]>;
    /**
     * Return a promise that resolve to an array of string containing all the typescript files name in the projects.
     */
    getProjectFiles(): promise.Promise<string[]>;
    /**
     * Read a file, return a promise that resolve to the file content.
     *
     * @param fileName the name of file to read.
     */
    readFile(fileName: string): promise.Promise<string>;
}
/**
 * An Enum representing the kind of change that migth occur in the fileSysem.
 */
export const enum FileChangeKind {
    /**
     * A file has been added.
     */
    ADD = 0,
    /**
     * A file has been updated.
     */
    UPDATE = 1,
    /**
     * A file has been deleted.
     */
    DELETE = 2,
    /**
     * The project files has been refreshed.
     */
    RESET = 3,
}
/**
 * FileSystem change descriptor.
 */
export type FileChangeRecord = {
    /**
     * kind of change.
     */
    kind: FileChangeKind;
    /**
     * The name of the file that have changed if any.
     */
    fileName?: string;
};


}

declare module 'typescript-project-services/lib/languageServiceHost' {

import ts = require('typescript');
/**
 * The LanguageServiceHost module provides an ts.LanguageServiceHost implementations
 */
interface LanguageServiceHost extends ts.LanguageServiceHost {
    /**
     * Add a script to the LanguageServiceHost.
     *
     * @param fileName the absolute path of the file.
     * @param content the file content.
     */
    addScript(fileName: string, content: string): void;
    /**
     * Remove a script from the LanguageServiceHost.
     *
     * @param fileName the absolute path of the file.
     */
    removeScript(fileName: string): void;
    /**
     * Remove all script from the LanguageServiceHost.
     *
     * @param fileName the absolute path of the file.
     */
    removeAll(): void;
    /**
     * Update a script.
     *
     * @param fileName the absolute path of the file.
     * @param content the new file content.
     */
    updateScript(fileName: string, content: string): void;
    /**
     * Edit a script.
     *
     * @param fileName the absolute path of the file
     * @param minChar the index in the file content where the edition begins.
     * @param limChar the index  in the file content where the edition ends.
     * @param newText the text inserted.
     */
    editScript(fileName: string, minChar: number, limChar: number, newText: string): void;
    /**
     * Set the `isOpen` status of a script.
     *
     * @param fileName the absolute file name.
     * @param isOpen open status.
     */
    setScriptIsOpen(fileName: string, isOpen: boolean): void;
    /**
     * The the language service host compilater options.
     *
     * @param the settings to be applied to the host.
     */
    setCompilationSettings(settings: ts.CompilerOptions): void;
    /**
     * Retrieve the content of a given file.
     *
     * @param fileName the absolute file name.
     */
    getScriptContent(fileName: string): string;
} module LanguageServiceHost {
    /**
     * LanguageServiceHost factory.
     *
     * @param currentDir the current directory opened in the editor
     * @param defaultLibFileName the absolute file name of the `lib.d.ts` files associated to the language service host instance.
     */
    function create(currentDir: string, defaultLibFileName: string): LanguageServiceHost;
}
export = LanguageServiceHost;


}

declare module 'typescript-project-services/lib/logger' {

/**
 * @module Logger
 *
 * The logger module provide basicly a subset of the console API,
 * Since the Service is designed to work in any environement we cannot make absumption about `console`
 * availability, the user is in charge of injecting an implementation.
 */
/**
 * A basic callable type representing `console.log`, `console.info`, etc...
 */
export type Logger = (message?: any, ...optionalParams: any[]) => void;
/**
 * Logger for basic information.
 */
export var info: (message?: any, ...optionalParams: any[]) => void;
/**
 * Logger used for warning.
 */
export var warn: (message?: any, ...optionalParams: any[]) => void;
/**
 * Logger used for error
 */
export var error: (message?: any, ...optionalParams: any[]) => void;
/**
 * Let the user inject logger used by the service.
 *
 * @param info information logger.
 * @param warn warning logger.
 * @param error error logger.
 */
export function injectLogger(info: Logger, warn: Logger, error: Logger): void;


}

declare module 'typescript-project-services/lib/project' {

import ts = require('typescript');
import promise = require('typescript-project-services/lib/promise');
import fs = require('typescript-project-services/lib/fileSystem');
import ws = require('typescript-project-services/lib/workingSet');
import utils = require('typescript-project-services/lib/utils');
import LanguageServiceHost = require('typescript-project-services/lib/languageServiceHost');
import CompilerManager = require('typescript-project-services/lib/compilerManager');
import TypeScriptInfo = CompilerManager.TypeScriptInfo;
import Set = utils.Set;
/**
 * Project Configuration.
 */
export type TypeScriptProjectConfig = {
    /**
     * Patterns used for glob matching sources file of the project
     */
    sources: string[] | string;
    /**
     * Compiler options
     */
    compilerOptions: ts.CompilerOptions;
    /**
     * Absolute path of the compiler directory
     */
    compilerDirectory?: string;
};
/**
 * A TypeScript project is responsible of managing an instance of LanguageService and LanguageServiceHost,
 * and expose those instance.
 * It will extract files and compiler options for a given configuration and feed the LanguageServiceHost accordingly.
 */
export interface TypeScriptProject {
    /**
     * Initialize the project.
     */
    init(): promise.Promise<void>;
    /**
     * Update a project accordingly to a new configuration.
     *
     * @param config the new project configuration.
     */
    update(config: TypeScriptProjectConfig): promise.Promise<void>;
    /**
     * Dispose the project.
     */
    dispose(): void;
    /**
     * Exposes the LanguageServiceHost instance managed by the project.
     */
    getLanguageServiceHost(): LanguageServiceHost;
    /**
     * Exposes the LanguageService instance managed by the project.
     */
    getLanguageService(): ts.LanguageService;
    /**
     * Exposes the typescript information used by the project.
     */
    getTypeScriptInfo(): TypeScriptInfo;
    /**
     * The set of files in the project sources.
     */
    getProjectFilesSet(): Set;
    /**
     * For a given file, give the relation between the project an the associated file.
     *
     * @param fileName the absolute file name of the file.
     */
    getProjectFileKind(fileName: string): ProjectFileKind;
}
/**
 * Describe the relation between a file and a project
 */
export const enum ProjectFileKind {
    /**
     * The file is not a part of the project.
     */
    NONE = 0,
    /**
     * The file is a source file of the project.
     */
    SOURCE = 1,
    /**
     * The file is referenced by a source file of the project.
     */
    REFERENCE = 2,
}
/**
 * TypeScriptProject factory.
 *
 * @param currentDir the absolute path to the current directory opended in the editor.
 * @param config the project configuration.
 * @param fileSystem the fileSystem wrapper instance used by this project.
 */
export function createProject(currentDir: string, config: TypeScriptProjectConfig, fileSystem: fs.IFileSystem, workingSet: ws.IWorkingSet): TypeScriptProject;


}

declare module 'typescript-project-services/lib/projectManager' {

import promise = require('typescript-project-services/lib/promise');
import fs = require('typescript-project-services/lib/fileSystem');
import ws = require('typescript-project-services/lib/workingSet');
import project = require('typescript-project-services/lib/project');
import utils = require('typescript-project-services/lib/utils');
import TypeScriptProject = project.TypeScriptProject;
import TypeScriptProjectConfig = project.TypeScriptProjectConfig;
import Map = utils.Map;
/**
 * @module ProjectManager
 *
 * This module manage the different project of the services.
 * This is the main entry point for creating/updating/deleting/retrieving projects.
 */
/**
 * ProjectManager configuration
 */
export type ProjectManagerConfig = {
    /**
     * Absolute fileName of the `lib.d.ts` file associated to the bundled compiler.
     */
    defaultLibFileName: string;
    /**
     * The file system wrapper instance used by this module.
     */
    fileSystem: fs.IFileSystem;
    /**
     * Working set service.
     */
    workingSet: ws.IWorkingSet;
    /**
     * A Map project name to project configuration
     */
    projectConfigs: {
        [projectId: string]: TypeScriptProjectConfig;
    };
};
/**
 * Initialize the ProjectManager module.
 *
 * @param config ProjectManager configuration
 */
export function init(config: ProjectManagerConfig): promise.Promise<void>;
/**
 * Dispose the ProjectManager module.
 */
export function dispose(): void;
/**
 * This function will try to find a project managing the given fileName.
 * It will first try to retrieve a project that have that file matching the `sources` configuration of the project.
 * Then it will try to retrieve a project where one of the sources files has a reference over the given file.
 * Finally if no project has been found a temp project will be instanciated/reused.
 *
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
export function getProjectForFile(fileName: string): promise.Promise<TypeScriptProject>;
/**
 * This function will try to find all projects managing the given fileName.
 * If no project has been found a temp project will be instanciated/reused.
 *
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
export function getAllProjectsForFile(fileName: string): promise.Promise<TypeScriptProject[]>;
/**
 * Retrieve all projects managed by the project manager
 *
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
export function getAllProjects(): promise.Promise<TypeScriptProject[]>;
export function updateProjectConfigs(configs: Map<TypeScriptProjectConfig>): promise.Promise<void>;


}

declare module 'typescript-project-services/lib/promise' {

export interface Thenable<R> {
    then<U>(onFulfill?: (value: R) => Thenable<U> | U, onReject?: (error: any) => Thenable<U> | U): Promise<U>;
}
export class Promise<R> implements Thenable<R> {
    constructor(callback: (resolve: (result: R | Thenable<R>) => void, reject: (error: any) => void) => void);
    then<U>(onFulfill?: (value: R) => Thenable<U> | U, onReject?: (error: any) => Thenable<U> | U): Promise<U>;
    catch<U>(onReject?: (error: any) => Thenable<U> | U): Promise<U>;
    static resolve<T>(object?: T | Thenable<T>): Promise<T>;
    static reject<T>(error?: any): Promise<T>;
    static all<T>(promises: (Thenable<T> | T)[]): Promise<T[]>;
    static race<T>(promises: (Thenable<T> | T)[]): Promise<T>;
}
export function injectPromiseLibrary(promise: typeof Promise): void;


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

declare module 'typescript-project-services/lib/utils' {

import minimatch = require('minimatch');
import promise = require('typescript-project-services/lib/promise');
/**
 * A PromiseQueue, used to insure that async task are executed sequentially.
 */
export interface PromiseQueue {
    /**
     * Add a task to the Queue, return a promise that will be resolved
     * with the result of that task
     *
     * @param task the task to execute.
     */
    then<T>(task: () => promise.Promise<T> | T): promise.Promise<T>;
    /**
     * Reset/init the promise queue, once this methid is called all task in the
     * promise queue will be executed sequentially once the initiam promise is resolved.
     *
     * @param init the inial async task of the queue.
     */
    reset<T>(init: promise.Promise<T>): promise.Promise<T>;
}
/**
 * PromiseQueue factory.
 */
export function createPromiseQueue(): PromiseQueue;
/**
 * C# like events and delegates for typed events dispatching.
 */
export interface ISignal<T> {
    /**
     * Subscribes a listener for the signal.
     *
     * @params listener the callback to call when events are dispatched.
     * @params priority an optional priority for this listerner
     */
    add(listener: (parameter: T) => any, priority?: number): void;
    /**
     * unsubscribe a listener for the signal
     *
     * @params listener the previously subscribed listener
     */
    remove(listener: (parameter: T) => any): void;
    /**
     * Dispatch an event.
     *
     * @params parameter the parameter attached to the event dispatched.
     */
    dispatch(parameter?: T): boolean;
    /**
     * Remove all listener from the signal.
     */
    clear(): void;
    /**
     * Returns true if listener has been subsribed to this signal.
     */
    hasListeners(): boolean;
}
/**
 * Reference ISignal implementation.
 */
export class Signal<T> implements ISignal<T> {
    /**
     * list of listeners that have been suscribed to this signal.
     */
    private listeners;
    /**
     * Priorities corresponding to the listeners.
     */
    private priorities;
    /**
     * Subscribes a listener for the signal.
     *
     * @params listener the callback to call when events are dispatched.
     * @params priority an optional priority for this listener.
     */
    add(listener: (parameter: T) => any, priority?: number): void;
    /**
     * Unsubscribe a listener for the signal.
     *
     * @params listener the previously subscribed listener
     */
    remove(listener: (parameter: T) => any): void;
    /**
     * Dispatches an event.
     *
     * @params parameter the parameter attached to the event dispatched.
     */
    dispatch(parameter?: T): boolean;
    /**
     * Removes all listener from the signal.
     */
    clear(): void;
    /**
     * Returns true if the listener has been subsribed to this signal.
     */
    hasListeners(): boolean;
}
/**
 * Assign all properties of a list of object to an object.
 *
 * @param target the object that will receive properties.
 * @param items objects which properties will be assigned to a target.
 */
export function assign(target: any, ...items: any[]): any;
/**
 * Clone an object (shallow).
 *
 * @param target the object to clone
 */
export function clone<T>(target: T): T;
/**
 * A recursive array
 */
export interface RecursiveArray<T> extends Array<T | RecursiveArray<T>> {
}
/**
 * flatten a recursive array
 *
 * @param array the array to flatten
 */
export function flatten<T>(array: RecursiveArray<T>): Array<T>;
/**
 * Browserify path.resolve is buggy on windows.
 *
 * @param from an absolute path.
 * @param to an relative path.
 */
export function pathResolve(from: string, to: string): string;
/**
 * Matching utils for path based on minimatch.
 *
 * @param baseDir the absolute directory path where the match happens.
 * @param fileName the absolute file name.
 * @param patterns the patterns to match the file against.
 * @param options minimatch options used for the match.
 */
export function match(baseDir: string, fileName: string, patterns: string[] | string, options?: minimatch.Options): boolean;
/**
 * Get a sha1 hash of a string.
 *
 * @param value the string to hash.
 */
export function getHash(value: string): string;
/**
 * Represent a Map, key are string.
 */
export interface Map<T> {
    [key: string]: T;
}
/**
 * A basic string Set.
 */
export type Set = Map<boolean>;
/**
 * Retrieve values of a map as aray.
 */
export function getMapValues<T>(map: Map<T>): T[];
/**
 * convert an array of string to a string Set.
 */
export function arrayToSet(arr: string[]): Set;


}

declare module 'typescript-project-services/lib/workingSet' {

import promise = require('typescript-project-services/lib/promise');
import utils = require('typescript-project-services/lib/utils');
import ISignal = utils.ISignal;
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
};
/**
 * An Enum listing the kind of change that might occur in the working set.
 */
export const enum WorkingSetChangeKind {
    /**
     * A file has been added to the working set.
     */
    ADD = 0,
    /**
     * A file has been removed from the working set.
     */
    REMOVE = 1,
}
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
};
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
    documentText?: string;
};


}

declare module 'typescript-project-services' {

import ts = require('typescript');
import promise = require('typescript-project-services/lib/promise');
import ProjectManager = require('typescript-project-services/lib/projectManager');
import fs = require('typescript-project-services/lib/fileSystem');
import ws = require('typescript-project-services/lib/workingSet');
import project = require('typescript-project-services/lib/project');
import Logger = require('typescript-project-services/lib/logger');
import utils = require('typescript-project-services/lib/utils');
/**
 * Let the user inject logger used by the service.
 *
 * @param info information logger.
 * @param warn warning logger.
 * @param error error logger.
 */
export var injectLogger: typeof Logger.injectLogger;
/**
 * Let the user inject Promise library used by the service,
 * it must be an es6 spec comliant promise library
 *
 * @param promise the Promise constructor of the injected library.
 */
export var injectPromiseLibrary: typeof promise.injectPromiseLibrary;
/**
 * ProjectManager configuration
 */
export import ProjectManagerConfig = ProjectManager.ProjectManagerConfig;
/**
 * Interface abstracting file system to provide adapter to the service.
 */
export import IFileSystem = fs.IFileSystem;
/**
 * FileSystem change descriptor.
 */
export import FileChangeRecord = fs.FileChangeRecord;
/**
 * An Enum representing the kind of change that migth occur in the fileSysem.
 */
export import FileChangeKind = fs.FileChangeKind;
/**
 * A service that will reflect files in the working set of the editor.
 */
export import IWorkingSet = ws.IWorkingSet;
/**
 * Describe a change in a document.
 */
export import DocumentChangeDescriptor = ws.DocumentChangeDescriptor;
/**
 * Describe a list of changes in a document.
 * You can provided either a `changeList` containing a description of all edition in the document,
 * or documentText providing the new document text.
 * If  the first method is used (`changeList`) the compiler will be able to use incremental compilation.
 */
export import DocumentChangeRecord = ws.DocumentChangeRecord;
/**
 * Describe a change in the working set.
 */
export import WorkingSetChangeRecord = ws.WorkingSetChangeRecord;
/**
 * An Enum listing the kind of change that might occur in the working set.
 */
export import WorkingSetChangeKind = ws.WorkingSetChangeKind;
/**
 * Project Configuration.
 */
export import TypeScriptProjectConfig = project.TypeScriptProjectConfig;
/**
 * C# like events and delegates for typed events dispatching.
 */
export import ISignal = utils.ISignal;
/**
 * Initializate the service.
 *
 * @param config the main service configuration
 */
export function init(config: ProjectManagerConfig): promise.Promise<void>;
/**
 * Update the configurations of the projects managed by this service.
 *
 * @param configs
 *   A map project name to project config file.
 *   if a project previously managed by this service is not present in the  map
 *   the project will be disposed.
 *   If a new project is present in the map, the project will be initialized
 *   Otherwise the project will be updated accordingly to the new configuration
 */
export function updateProjectConfigs(configs: {
    [projectId: string]: TypeScriptProjectConfig;
}): promise.Promise<void>;
/**
 * Dispose the service.
 */
export function dispose(): void;
/**
 * Represent a text span in the document.
 */
export type TextSpan = {
    /**
     * The start of the text span.
     */
    start: number;
    /**
     * The length of the text span.
     */
    length: number;
};
/**
 * Represent an error diagnostic.
 */
export type Diagnostics = {
    /**
     * The name of the file related to this diagnostic.
     */
    fileName: string;
    /**
     * Start position of the error.
     */
    start: number;
    /**
     * Length of the error.
     */
    length: number;
    /**
     * Error message.
     */
    messageText: string;
    /**
     * Diagnostic category. (warning, error, message)
     */
    category: ts.DiagnosticCategory;
    /**
     * Error code
     */
    code: number;
};
/**
 * Retrieve a list of errors for a given file
 * return a promise resolving to a list of errors
 *
 * @param fileName the absolute file name
 * @param allErrors by default errors are checked in 3 phases, options check, syntax check,
 *   semantic check, is allErrors is set to false, the service won't check the nex phase
 *   if there is error in the precedent one
 */
export function getDiagnosticsForFile(fileName: string, allErrors?: boolean): promise.Promise<Diagnostics[]>;
/**
 * Represent the result of completion request
 */
export type CompletionResult = {
    /**
     * the matched string portion
     */
    match: string;
    /**
     * list of proposed entries for code completion
     */
    entries: ts.CompletionEntryDetails[];
};
/**
 * Retrieve completion proposal at a given point in a given file.
 * return a promise resolving to a list of completion proposals.
 *
 * @param fileName the absolute file name.
 * @param position the position in the file where the completion is requested.
 * @param limit the max number of proposition this service shoudl return.
 * @param skip the number of proposition this service should skip.
 *
 */
export function getCompletionAtPosition(fileName: string, position: number, limit?: number, skip?: number): promise.Promise<CompletionResult>;
/**
 * Represent the result of a quickInfo request
 */
export type QuickInfo = {
    kind: string;
    kindModifiers: string;
    textSpan: TextSpan;
    displayParts: ts.SymbolDisplayPart[];
    documentation: ts.SymbolDisplayPart[];
};
/**
 * Retrieve information about type/documentation for the givent file name at the given position.
 *
 * @param fileName the absolute file name.
 * @param position the position in the file where the informations are requested.
 */
export function getQuickInfoAtPosition(fileName: string, position: number): promise.Promise<QuickInfo>;
/**
 * Represent information about a function signature
 */
export type SignatureHelpItems = {
    items: ts.SignatureHelpItem[];
    applicableSpan: TextSpan;
    selectedItemIndex: number;
    argumentIndex: number;
    argumentCount: number;
};
/**
 * Retrieve signature information about a function being called.
 *
 * @param fileName the absolute file name.
 * @param position the position in the file where the informations are requested.
 */
export function getSignatureHelpItems(fileName: string, position: number): promise.Promise<SignatureHelpItems>;
/**
 * Represent renam information
 */
export type RenameInfo = {
    canRename: boolean;
    localizedErrorMessage: string;
    displayName: string;
    fullDisplayName: string;
    kind: string;
    kindModifiers: string;
    triggerSpan: TextSpan;
};
/**
 * Retrieve rename informations about a symbol at a given position.
 * This method will look into all the projects, and returns the first positive renameInfo found.
 *
 * @param fileName the absolute file name.
 * @param position the position in the file where the rename informations are requested.
 */
export function getRenameInfo(fileName: string, position: number): promise.Promise<RenameInfo>;
/**
 * Retrieve locations where a rename must occurs.
 * This methods apply to all the project that manage the given file.
 *
 * @param fileName the absolute file name.
 * @param position the position of the symbol to rename.
 * @param findInComments if true the service will also look into comments.
 */
export function findRenameLocations(fileName: string, position: number, findInStrings: boolean, findInComments: boolean): promise.Promise<{
    textSpan: TextSpan;
    fileName: string;
}[]>;
/**
 * Represent information about a typescript definition.
 */
export type DefinitionInfo = {
    fileName: string;
    textSpan: TextSpan;
    kind: string;
    name: string;
    containerKind: string;
    containerName: string;
};
/**
 * Retrieve informations about a typescript definition.
 *
 * @param fileName the absolute file name.
 * @param position the position of the definition in the file.
 */
export function getDefinitionAtPosition(fileName: string, position: number): promise.Promise<DefinitionInfo[]>;
/**
 * Represent information about a reference.
 */
export type ReferenceEntry = {
    textSpan: TextSpan;
    fileName: string;
    isWriteAccess: boolean;
};
/**
 * Retrieve a symbol references accros a project.
 * This method look into every project that manage the given file.
 *
 * @param fileName the absolute file name.
 * @param position the position of the symbol.
 */
export function getReferencesAtPosition(fileName: string, position: number): promise.Promise<ReferenceEntry[]>;
/**
 * Retrieve a symbol references accros a file.
 *
 * @param fileName the absolute file name.
 * @param position the position of the symbol.
 */
export function getOccurrencesAtPosition(fileName: string, position: number): promise.Promise<ReferenceEntry[]>;
/**
 * Retrieve navigation information
 */
export type NavigateToItem = {
    name: string;
    kind: string;
    kindModifiers: string;
    matchKind: string;
    fileName: string;
    textSpan: TextSpan;
    containerName: string;
    containerKind: string;
};
/**
 * Retrieve information about navigation between files of the project
 *
 * @param position the searched string.
 */
export function getNavigateToItems(search: string): promise.Promise<NavigateToItem[]>;
/**
 * Represent a Nigation bar item
 */
export type NavigationBarItem = {
    text: string;
    kind: string;
    kindModifiers: string;
    spans: {
        start: number;
        length: number;
    }[];
    childItems: NavigationBarItem[];
    indent: number;
    bolded: boolean;
    grayed: boolean;
};
/**
 * Retrieve navigation bar for the givent file
 *
 * @param fileName the absolute file name.
 */
export function getNavigationBarItems(fileName: string): promise.Promise<NavigationBarItem[]>;
/**
 * Represent a change to apply in the document for formatting.
 */
export type TextChange = {
    /**
     * The text span to replace.
     */
    span: TextSpan;
    /**
     * The new text to insert.
     */
    newText: string;
};
/**
 * Retrieve formating information for a file or range in a file.
 *
 * @param fileName the absolute file name.
 * @param options formatting options.
 * @param start if start and end are provided the formatting will only be applied on that range.
 * @param end if start and end are provided the formatting will only be applied on that range.
 */
export function getFormattingEditsForFile(fileName: string, options: ts.FormatCodeOptions, start?: number, end?: number): promise.Promise<TextChange[]>;
/**
 * Retrieve formating information after a key stroke (use for auto formating)
 *
 * @param fileName the absolute file name.
 * @param options formatting options.
 * @param position the position where the key stroke occured.
 * @param key the key.
 */
export function getFormattingEditsAfterKeyStroke(fileName: string, options: ts.FormatCodeOptions, position: number, key: string): promise.Promise<TextChange[]>;
/**
 * Retrieve emit output for a file name
 *
 * @param fileName the absolute file name.
 */
export function getEmitOutput(fileName: string): promise.Promise<ts.EmitOutput>;


}
