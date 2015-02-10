'use strict';

import ts = require('typescript');
import promise = require('./promise');
import ProjectManager = require('./projectManager');
import fs = require('./fileSystem');
import ws = require('./workingSet');
import project = require('./project');
import serviceUtils = require('./serviceUtils');
import Logger = require('./logger');
import utils = require('./utils');


//--------------------------------------------------------------------------
//
//  Logger Injection
//
//--------------------------------------------------------------------------

/**
 * Let the user inject logger used by the service.
 * 
 * @param info information logger.
 * @param warn warning logger.
 * @param error error logger.
 */
export var injectLogger = Logger.injectLogger;

//--------------------------------------------------------------------------
//
//  Promise Injection
//
//--------------------------------------------------------------------------
/**
 * Let the user inject Promise library used by the service, 
 * it must be an es6 spec comliant promise library
 * 
 * @param promise the Promise constructor of the injected library.
 */
export var injectPromiseLibrary = promise.injectPromiseLibrary;

//--------------------------------------------------------------------------
//
//  Project LifeCycle
//
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
//  Definitions
//--------------------------------------------------------------------------

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
export import FileChangeKind = fs.FileChangeKind

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

//--------------------------------------------------------------------------
//  init
//--------------------------------------------------------------------------

/**
 * Initializate the service.
 * 
 * @param config the main service configuration
 */
export function init(config: ProjectManagerConfig): promise.Promise<void> {
    return ProjectManager.init(config);
}

//--------------------------------------------------------------------------
//  updateProjectConfigs
//--------------------------------------------------------------------------

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
export function updateProjectConfigs(configs: { [projectId: string]: TypeScriptProjectConfig; }): promise.Promise<void> {
    return ProjectManager.updateProjectConfigs(configs);
}


/**
 * Dispose the service.
 */
export function dispose(): void {
    ProjectManager.dispose();
}

//--------------------------------------------------------------------------
//
//  Services
//
//--------------------------------------------------------------------------


//--------------------------------------------------------------------------
//  Globally used definition
//--------------------------------------------------------------------------

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
}

/**
 * Convert a TextSpan in typescript compiler format to raw json format.
 * Since depending of the version of the language service 
 * 
 * @param span the text span to convert.
 */
function tsSpanToTextSpan(span : ts.TextSpan | { start: number; length: number; }): TextSpan {
    var start: number;
    var length: number;
    
    if (typeof span.start === 'function') {
        start = (<ts.TextSpan>span).start();
        length = (<ts.TextSpan>span).length();
    } else {
        start = (<TextSpan>span).start;
        length = (<TextSpan>span).length
    }
    
    return { start, length };
}


//--------------------------------------------------------------------------
//  getDiagnosticsForFile
//--------------------------------------------------------------------------

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
}

/**
 * Retrieve a list of errors for a given file
 * return a promise resolving to a list of errors
 * 
 * @param fileName the absolute file name
 * @param allErrors by default errors are checked in 3 phases, options check, syntax check, 
 *   semantic check, is allErrors is set to false, the service won't check the nex phase 
 *   if there is error in the precedent one
 */
export function getDiagnosticsForFile(fileName: string, allErrors = false): promise.Promise<Diagnostics[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        var diagnostics = languageService.getCompilerOptionsDiagnostics();
        
        if (diagnostics.length === 0 || allErrors) {
            diagnostics = languageService.getSyntacticDiagnostics(fileName);
        }

        if (diagnostics.length === 0 || allErrors) {
            diagnostics = languageService.getSemanticDiagnostics(fileName);
        }
        
        return diagnostics.map(diagnostic => ({
            fileName: fileName,
            start: diagnostic.start,
            length: diagnostic.length,
            messageText: diagnostic.messageText,
            category: diagnostic.category,
            code: diagnostic.code
        }));
    });
}


//--------------------------------------------------------------------------
//  getCompletionAtPosition
//--------------------------------------------------------------------------

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
}


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
export function getCompletionAtPosition(fileName: string, position: number, limit = 50, skip = 0): promise.Promise<CompletionResult> {
    return ProjectManager.getProjectForFile(fileName).then(project => {

        var languageService = project.getLanguageService(),
            completionInfo = languageService.getCompletionsAtPosition(fileName, position),
            typeScriptEntries = completionInfo && completionInfo.entries;


        if (!typeScriptEntries) {
            return { entries: [], match: '' };
        }

        var match: string;

        var sourceFile = languageService.getSourceFile(fileName);
        var ts = project.getTypeScriptInfo().ts;
        var word = serviceUtils.getTouchingWord(sourceFile, position, ts);


        if (word && serviceUtils.isWord(word.kind, ts)) {
            match = word.getText();
            typeScriptEntries = typeScriptEntries.filter(entry => {
                return entry.name && entry.name.toLowerCase().indexOf(match.toLowerCase()) === 0;
            });
        }



        var completionEntries = typeScriptEntries
            .sort((entry1, entry2) => {
                var match1 = entry1 ? entry1.name.indexOf(match) : -1,
                    match2 = entry2 ? entry2.name.indexOf(match) : -1;
                if (match1 === 0 && match2 !== 0) {
                    return -1;
                } else if (match2 === 0 && match1 !== 0) {
                    return 1;
                } else {
                    var name1 = entry1 && entry1.name.toLowerCase(),
                        name2 = entry2 && entry2.name.toLowerCase();

                    if (name1 < name2) {
                        return -1;
                    } else if (name1 > name2) {
                        return 1;
                    } else {
                        return 0;
                    }
                }
            })
            .slice(skip, limit + skip)
            .map(typeScriptEntry => languageService.getCompletionEntryDetails(fileName, position, typeScriptEntry.name));

        return {
            entries: completionEntries,
            match: match
        };
    });
}


//--------------------------------------------------------------------------
//  getQuickInfoAtPosition
//--------------------------------------------------------------------------

/**
 * Represent the result of a quickInfo request
 */
export type QuickInfo = {
    kind: string;
    kindModifiers: string;
    textSpan: TextSpan;
    displayParts: ts.SymbolDisplayPart[];
    documentation: ts.SymbolDisplayPart[];
}

/**
 * Retrieve information about type/documentation for the givent file name at the given position.
 * 
 * @param fileName the absolute file name.
 * @param position the position in the file where the informations are requested.
 */
export function getQuickInfoAtPosition(fileName:string, position: number): promise.Promise<QuickInfo> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        var info = languageService.getQuickInfoAtPosition(fileName, position)
        return {
            kind: info.kind,
            kindModifiers: info.kindModifiers,
            textSpan: tsSpanToTextSpan(info.textSpan),
            displayParts: info.displayParts,
            documentation: info.documentation
        }
    });
}


//--------------------------------------------------------------------------
//  getSignatureHelpItems
//--------------------------------------------------------------------------

/**
 * Represent information about a function signature
 */
export type SignatureHelpItems = {
    items: ts.SignatureHelpItem[];
    applicableSpan: TextSpan;
    selectedItemIndex: number;
    argumentIndex: number;
    argumentCount: number;
}

/**
 * Retrieve signature information about a function being called.
 * 
 * @param fileName the absolute file name.
 * @param position the position in the file where the informations are requested.
 */
export function getSignatureHelpItems(fileName:string, position: number): promise.Promise<SignatureHelpItems> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        var signature = languageService.getSignatureHelpItems(fileName, position)
        return {
            items: signature.items,
            applicableSpan: tsSpanToTextSpan(signature.applicableSpan),
            selectedItemIndex: signature.selectedItemIndex,
            argumentIndex: signature.argumentIndex,
            argumentCount: signature.argumentCount
        }
    });
}

//--------------------------------------------------------------------------
//  getRenameInfo
//--------------------------------------------------------------------------

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
}

/**
 * Retrieve rename informations about a symbol at a given position.
 * 
 * @param fileName the absolute file name.
 * @param position the position in the file where the rename informations are requested.
 */
export function getRenameInfo(fileName:string, position: number): promise.Promise<RenameInfo> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        var info = languageService.getRenameInfo(fileName, position)
        return {
            canRename: info.canRename,
            localizedErrorMessage: info.localizedErrorMessage,
            displayName: info.displayName,
            fullDisplayName: info.fullDisplayName,
            kind: info.kind,
            kindModifiers: info.kindModifiers,
            triggerSpan: tsSpanToTextSpan(info.triggerSpan)
        }
    });
}


//--------------------------------------------------------------------------
//  getRenameInfo
//--------------------------------------------------------------------------

/**
 * Retrieve locations where a rename must occurs.
 * 
 * @param fileName the absolute file name.
 * @param position the position of the symbol to rename.
 * @param findInComments if true the service will also look into comments.
 */
export function findRenameLocations(
        fileName:string, position: number, 
        findInStrings: boolean, findInComments: boolean
    ): promise.Promise<{ textSpan: TextSpan; fileName: string;}[]> {
    
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        return languageService.findRenameLocations(fileName, position, findInStrings, findInComments)
            .map(location => ({
                textSpan: tsSpanToTextSpan(location.textSpan),
                fileName: location.fileName
            }));
    });
}

//--------------------------------------------------------------------------
//  getDefinitionAtPosition
//--------------------------------------------------------------------------

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
}

/**
 * Retrieve informations about a typescript definition.
 * 
 * @param fileName the absolute file name.
 * @param position the position of the definition in the file.
 */
export function getDefinitionAtPosition(fileName: string, position: number): promise.Promise<DefinitionInfo[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        return languageService.getDefinitionAtPosition(fileName, position)
            .map(def => ({
                fileName: def.fileName,
                textSpan: tsSpanToTextSpan(def.textSpan),
                kind: def.kind,
                name: def.name,
                containerKind: def.containerKind,
                containerName: def.containerName
            }))
    });
}

//--------------------------------------------------------------------------
//  getReferencesAtPosition
//--------------------------------------------------------------------------

/**
 * Represent information about a reference.
 */
export type ReferenceEntry = {
    textSpan: TextSpan;
    fileName: string;
    isWriteAccess: boolean;
}


/**
 * Retrieve a symbol references accros a project.
 * 
 * @param fileName the absolute file name.
 * @param position the position of the symbol.
 */
export function getReferencesAtPosition(fileName: string, position: number): promise.Promise<ReferenceEntry[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        return languageService.getReferencesAtPosition(fileName, position)
            .map(ref => ({
                fileName: ref.fileName,
                textSpan: tsSpanToTextSpan(ref.textSpan),
                isWriteAccess: ref.isWriteAccess
            }))
    });
}


//--------------------------------------------------------------------------
//  getOccurrencesAtPosition
//--------------------------------------------------------------------------


/**
 * Retrieve a symbol references accros a file.
 * 
 * @param fileName the absolute file name.
 * @param position the position of the symbol.
 */
export function getOccurrencesAtPosition(fileName: string, position: number): promise.Promise<ReferenceEntry[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        return languageService.getOccurrencesAtPosition(fileName, position)
            .map(ref => ({
                fileName: ref.fileName,
                textSpan: tsSpanToTextSpan(ref.textSpan),
                isWriteAccess: ref.isWriteAccess
            }))
    });
}


//--------------------------------------------------------------------------
//  getNavigateToItems
//--------------------------------------------------------------------------

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
}


/**
 * Retrieve information about navigation between files of the project
 * 
 * @param fileName the absolute file name.
 * @param position the searched string.
 */
export function getNavigateToItems(fileName:string, search: string): promise.Promise<NavigateToItem[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        return languageService.getNavigateToItems(search)
            .map(item => ({
                name: item.name,
                kind: item.kind,
                kindModifiers: item.kindModifiers,
                matchKind: item.matchKind,
                fileName: item.fileName,
                textSpan: tsSpanToTextSpan(item.textSpan),
                containerName: item.containerName,
                containerKind: item.containerKind
            }))
    });
}


//--------------------------------------------------------------------------
//  getNavigationBarItems
//--------------------------------------------------------------------------

/**
 * Represent a Nigation bar item
 */
export type NavigationBarItem = {
    text: string;
    kind: string;
    kindModifiers: string;
    spans: { start: number; length: number }[];
    childItems: NavigationBarItem[];
    indent: number;
    bolded: boolean;
    grayed: boolean;
}

/**
 * Convert a typescript navigation bar item to raw json format.
 */
function tsNavigationBarItemToNavigationBarItem(item: ts.NavigationBarItem) : NavigationBarItem {
    return {
        text: item.text,
        kind: item.kind,
        kindModifiers: item.kindModifiers,
        indent: item.indent,
        bolded: item.bolded,
        grayed: item.grayed,
        spans: item.spans && item.spans.map(tsSpanToTextSpan),
        childItems: item.childItems && item.childItems.map(tsNavigationBarItemToNavigationBarItem)
    }
}

/**
 * Retrieve navigation bar for the givent file
 * 
 * @param fileName the absolute file name.
 */
export function getNavigationBarItems(fileName: string): promise.Promise<NavigationBarItem[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        return languageService.getNavigationBarItems(fileName).map(tsNavigationBarItemToNavigationBarItem);
    });
}


//--------------------------------------------------------------------------
//  getFormattingEditsForRange
//--------------------------------------------------------------------------


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
}

/**
 * Retrieve formating information for a file or range in a file.
 * 
 * @param fileName the absolute file name.
 * @param options formatting options.
 * @param start if start and end are provided the formatting will only be applied on that range.
 * @param end if start and end are provided the formatting will only be applied on that range.
 */
export function getFormattingEditsForFile(fileName: string, options: ts.FormatCodeOptions, start?: number, end?: number): promise.Promise<TextChange[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        if(typeof start === 'number' && typeof end === 'number') {
            return languageService.getFormattingEditsForRange(fileName, start, end, options)
                .map(edit =>({
                    span: tsSpanToTextSpan(edit.span),
                    newText: edit.newText
                }))
        } else {
            return languageService.getFormattingEditsForDocument(fileName,  options)
                .map(edit =>({
                    span: tsSpanToTextSpan(edit.span),
                    newText: edit.newText
                }))
        }
        
    });
}



//--------------------------------------------------------------------------
//  getFormattingEditsForRange
//--------------------------------------------------------------------------

/**
 * Retrieve formating information after a key stroke (use for auto formating)
 * 
 * @param fileName the absolute file name.
 * @param options formatting options.
 * @param position the position where the key stroke occured.
 * @param key the key.
 */
export function getFormattingEditsAfterKeyStroke(
    fileName: string, 
    options: ts.FormatCodeOptions, 
    position: number, 
    key: string): promise.Promise<TextChange[]> {
    
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        return languageService.getFormattingEditsAfterKeystroke(fileName, position, key, options)
            .map(edit =>({
                span: tsSpanToTextSpan(edit.span),
                newText: edit.newText
            }))
    });
}


//--------------------------------------------------------------------------
//  getEmitOutput
//--------------------------------------------------------------------------

/**
 * Retrieve emit output for a file name
 * 
 * @param fileName the absolute file name.
 */
export function getEmitOutput(fileName: string): promise.Promise<ts.EmitOutput> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        return languageService.getEmitOutput(fileName)
    });
}


