/*jshint node:true*/

///<reference path="../src/declarations/typescript.d.ts" />
///<reference path="./typescript_internal.d.ts" />


declare var require: any;
declare var process: any;

var args = process.argv.slice(2);

if (args.length === 0) {
    printUsage('not enough arguments');
}

var command = require('minimist')(args);
function printUsage(error?) {
    console.log('node generate-markdowndoc --moduleName myModuleName --baseDir base/dir --mainFile mainFile.ts otherFile.ts');
    if (error) {
        console.error(error);
        process.exit(1);
    }
}

if (command.help) {
    printUsage();
}

if (!command.moduleName) {
    printUsage('--moduleName option is mandatory');
}

if (!command.docDir) {
    throw new Error('--docDir option is mandatory');
}

if (!command.mainFile) {
    throw new Error('--mainFile option is mandatory');
}


var fs = require('fs');
var path = require('path');
var basePath = process.cwd();

var docDir = path.resolve(process.cwd(), command.docDir);

var mainFilePath = path.resolve(process.cwd(), command.mainFile);
var fileNames = [mainFilePath];
if (command._) {
    fileNames = fileNames.concat(
        command._.map(function (file) {
            return path.resolve(process.cwd(), file);
        })
    );
}

import ts = require('typescript');

var options: ts.CompilerOptions = { 
    noEmitOnError: true, 
    noImplicitAny: true,
    target: ts.ScriptTarget.ES5, 
    module: ts.ModuleKind.CommonJS,
    noLib: true
};


var host = ts.createCompilerHost(options);
var program = ts.createProgram(fileNames, options, host);
var checker = ts.createTypeChecker(program, /*produceDiagnostics*/ true);


var sourceFile = program.getSourceFile(mainFilePath);
var functionsDeclarations: ts.FunctionDeclaration[] = [];
var objectDeclarations: ts.InterfaceDeclaration[] = [];


function visitNode(node: ts.Node) {
    switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration:
            if (node.flags & ts.NodeFlags.Export) {
                var importDeclaration = <ts.ImportDeclaration>node;
                if (importDeclaration.moduleReference.kind !== ts.SyntaxKind.ExternalModuleReference) {
                    var type = checker.getTypeAtLocation(importDeclaration.moduleReference);
                    if (type.symbol.declarations[0]) {
                         visitNode(type.symbol.declarations[0]);
                    }
                   
                }
            }
            return;
        case ts.SyntaxKind.FunctionDeclaration:
            if (node.flags & ts.NodeFlags.Export) {
                functionsDeclarations.push(<ts.FunctionDeclaration>node);
            }
            return;
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.EnumDeclaration:
            if (node.flags & ts.NodeFlags.Export) {
                objectDeclarations.push(<any>node);
            }
            return;
            
        
        // We does not handle thoses declaration because they are handled at parent level
        // or we don't use them in the project
        //        case ts.SyntaxKind.TypeParameter:
        //        case ts.SyntaxKind.Parameter:
        //        case ts.SyntaxKind.VariableDeclaration:
        //        case ts.SyntaxKind.Property:
        //        case ts.SyntaxKind.PropertyAssignment:
        //        case ts.SyntaxKind.ShorthandPropertyAssignment:
        //        case ts.SyntaxKind.EnumMember:
        //        case ts.SyntaxKind.Method:
        //        case ts.SyntaxKind.FunctionDeclaration:
        //        case ts.SyntaxKind.GetAccessor:
        //        case ts.SyntaxKind.SetAccessor:
        //        case ts.SyntaxKind.Constructor:
        //        case ts.SyntaxKind.ClassDeclaration:
        //        case ts.SyntaxKind.InterfaceDeclaration:
        //        case ts.SyntaxKind.TypeAliasDeclaration:
        //        case ts.SyntaxKind.EnumDeclaration:
        //        case ts.SyntaxKind.ModuleDeclaration:
        //        case ts.SyntaxKind.ImportDeclaration:
          
    }
    ts.forEachChild(node, visitNode);
}

visitNode(sourceFile);





var renames: {
    search: RegExp;
    replace :string
}[] = [
    {
        search: /^promise\./g,
        replace: ''
    }
];

function renameType(type: string) {
    return renames.reduce((type, rename) => {
        return type.replace(rename.search, rename.replace);
    }, type)
}

var codeDelimiter = '\n```\n';


function getNodePosLink(node: ts.Node) {
    var sourceFile = ts.getSourceFileOfNode(node);
    var relativeFileName = path.relative(docDir, sourceFile.filename);
    var baseName = path.basename(sourceFile.filename)
    var start = ts.getLineAndCharacterOfPosition(sourceFile.getLineStarts(), node.pos);
    var end = ts.getLineAndCharacterOfPosition(sourceFile.getLineStarts(), node.pos);
    
    return `[${baseName}](${relativeFileName}#L${start.line}-L${end.line})`
}

function transformFunctionDeclartion(node: ts.FunctionDeclaration) {
    var type = checker.getTypeAtLocation(node);
    
    var result = `### ${node.name.text}\n`;
    result += `\nsee ${getNodePosLink(node)}.\n`;
    result += `${codeDelimiter}${node.name.text}`;
    
    if (node.typeParameters) {
        result += `< ${node.typeParameters.map(param => ts.getTextOfNode(param)).join(', ')} >`;
    }
    result+= '(';
    
    result += node.parameters.map(param => {
        var paramText = ''
        paramText += param.name.text;
        
        if (param.questionToken) {
            paramText += '?';
        }
        if (param.type) {
            paramText += ': ' + ts.getTextOfNode(param.type);
        } else if (param.initializer) {
            var type = checker.getTypeAtLocation(param.initializer);
            if (type) {
                paramText += '?: ' +  renameType(checker.typeToString(type))
            }
        }
        return paramText;
    }).join(', ');
    
    result += `): ${node.type ? renameType(ts.getTextOfNode(node.type)): 'void'}${codeDelimiter}`; 
    
    if (type) {
        result += '  \n'
        result += type.symbol ? type.symbol.getDocumentationComment().map(part => part.text).join('') : 
                ''
        result+='\n';
    }
    
    if (node.parameters.length) {
        result += `\n${
                node.parameters.map(param => {
                    var result = `* ${param.name.text}`;
                    var doc = param.symbol && param.symbol.getDocumentationComment().map(part => part.text).join('');
                    if (doc) {
                        result += `: ${doc}`;
                    }
                    return result;
                }).join('\n')
            }\n`;
    }
    
    return result;
}


function transformObjectType(node: ts.InterfaceDeclaration | ts.TypeLiteralNode) {
    
    var result = `### ${ts.getTextOfNode(node.name)}\n`;
    result += `\nsee ${getNodePosLink(node)}.\n`;
    
    var type = checker.getTypeAtLocation(node);
    if (type) {
        result += '  \n'
        result += type.symbol ? type.symbol.getDocumentationComment().map(part => part.text).join('') : 
                ''
        result+='\n';
    }
    
    return result + `${codeDelimiter}${ts.getTextOfNode(node)}${codeDelimiter}`;;
}

process.stdout.write(
`
# API Documentation

## Functions

${functionsDeclarations.map(transformFunctionDeclartion).join('\n')}

## Types

${objectDeclarations.map(transformObjectType).join('\n')}

`)
