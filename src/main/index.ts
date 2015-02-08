'use strict';

import ts = require('typescript');
import promise = require('./promise');
import ProjectManager = require('./projectManager');
import fs = require('./fileSystem');
import ws = require('./workingSet');
import project = require('./project');
import serviceUtils = require('./serviceUtils');
import console = require('./logger');
import utils = require('./utils');


//--------------------------------------------------------------------------
//
//  Logger Injection
//
//--------------------------------------------------------------------------

export import Logger = console.Logger;

export var injectLogger = console.injectLogger;

//--------------------------------------------------------------------------
//
//  Promise Injection
//
//--------------------------------------------------------------------------

export var injectPromiseLibrary = promise.injectPromiseLibrary;

//--------------------------------------------------------------------------
//
//  Project LifeCycle
//
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
//  Definitions
//--------------------------------------------------------------------------

export import ProjectManagerConfig = ProjectManager.ProjectManagerConfig;

export import IFileSystem = fs.IFileSystem;
export import FileChangeRecord = fs.FileChangeRecord;
export import FileChangeKind = fs.FileChangeKind

export import IWorkingSet = ws.IWorkingSet;
export import DocumentChangeDescriptor = ws.DocumentChangeDescriptor;
export import DocumentChangeRecord = ws.DocumentChangeRecord;
export import WorkingSetChangeRecord = ws.WorkingSetChangeRecord;
export import WorkingSetChangeKind = ws.WorkingSetChangeKind;

export import TypeScriptProjectConfig = project.TypeScriptProjectConfig;


export import ISignal = utils.ISignal;
export import Signal = utils.Signal;

//--------------------------------------------------------------------------
//  init
//--------------------------------------------------------------------------

/**
 * Initializate the service
 * 
 * @param config the config used for the project managed
 */
export function init(config: ProjectManagerConfig): promise.Promise<void> {
    return ProjectManager.init(config);
}

//--------------------------------------------------------------------------
//  updateProjectConfigs
//--------------------------------------------------------------------------

/**
 * Update the configurations of the projects managed by this services.
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
 * dispose the service
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
export type TextSpan = {
    start: number;
    length: number;
}

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

export type Diagnostics = {
    fileName: string;
    start: number;
    length: number;
    messageText: string;
    category: ts.DiagnosticCategory;
    code: number;
}

/**
 * Retrieve a list of errors for a given file
 * return a promise resolving to a list of errors
 * 
 * @param fileName the absolute path of the file 
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
 * @param fileName the absolute path of the file 
 * @param position in the file where you want to retrieve completion proposal
 * @param limit the max number of proposition this service shoudl return
 * @param skip the number of proposition this service should skip
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
        var typeScript = project.getTypeScriptInfo().typeScript;
        var word = serviceUtils.getTouchingWord(sourceFile, position, typeScript);


        if (word && serviceUtils.isWord(word.kind, typeScript)) {
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


export type QuickInfo = {
    kind: string;
    kindModifiers: string;
    textSpan: TextSpan;
    displayParts: ts.SymbolDisplayPart[];
    documentation: ts.SymbolDisplayPart[];
}


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

export type SignatureHelpItems = {
    items: ts.SignatureHelpItem[];
    applicableSpan: TextSpan;
    selectedItemIndex: number;
    argumentIndex: number;
    argumentCount: number;
}


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

export type RenameInfo = {
    canRename: boolean;
    localizedErrorMessage: string;
    displayName: string;
    fullDisplayName: string;
    kind: string;
    kindModifiers: string;
    triggerSpan: TextSpan;
}

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

export type DefinitionInfo = {
    fileName: string;
    textSpan: TextSpan;
    kind: string;
    name: string;
    containerKind: string;
    containerName: string;
}

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

export type ReferenceEntry = {
    textSpan: TextSpan;
    fileName: string;
    isWriteAccess: boolean;
}

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

export function getNavigationBarItems(fileName: string): promise.Promise<NavigationBarItem[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        return languageService.getNavigationBarItems(fileName).map(tsNavigationBarItemToNavigationBarItem);
    });
}


//--------------------------------------------------------------------------
//  getFormattingEditsForRange
//--------------------------------------------------------------------------


export type TextChange = {
    span: TextSpan;
    newText: string;
}

export function getFormattingEditsForFile(fileName: string, options: ts.FormatCodeOptions, start: number, end: number): promise.Promise<TextChange[]> {
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


export function getFormattingEditsAfterKeyStroke(fileName: string, options: ts.FormatCodeOptions, position: number, key: string): promise.Promise<TextChange[]> {
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


export function getEmitOutput(fileName: string): promise.Promise<ts.EmitOutput> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService();
        return languageService.getEmitOutput(fileName)
    });
}


