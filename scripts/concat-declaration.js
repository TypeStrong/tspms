/*jshint node: true*/

var args = process.argv.slice(2);

if (args.length === 0) {
    printUsage('not enough arguments');
}

var command = require('minimist')(args);
function printUsage(error) {
    console.log('node concat-declaration.js --moduleName myModuleName --mainFile mainFile.d.ts file1.d.ts file2.d.ts ....');
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


if (!command.mainFile) {
    throw new Error('--mainFile option is mandatory');
}


var fs = require('fs');
var path = require('path');
var mainFilePath = path.resolve(process.cwd(), command.mainFile);

var basePath = process.cwd();

var files = command._ && command._.map(function (file) {
   return path.resolve(process.cwd(), file);
});



var map = files.reduce(function (map, fileName) {
    map[fileName] =  path.join(
        command.moduleName, 
        path.relative(
            basePath, 
            path.join(
                path.dirname(fileName), 
                path.basename(fileName, '.d.ts')
            )
        )
    );
    return map;
}, {});


map[mainFilePath] = command.moduleName;
files.push(mainFilePath);

var ts = require('typescript');




function fixupParentReferences(sourceFile) {
    // normally parent references are set during binding.
    // however here SourceFile data is used only for syntactic features so running the whole binding process is an overhead.
    // walk over the nodes and set parent references
    var parent = sourceFile;
    function walk(n) {
        n.parent = parent;

        var saveParent = parent;
        parent = n;
        ts.forEachChild(n, walk);
        parent = saveParent;
    }
    ts.forEachChild(sourceFile, walk);
}


function createRequire(moduleName) {
    return ' require(\''+ moduleName +'\')';
}

function transformSourceFile(filePath, sourceFile, text, imports) {
    var result = '';
    var index = 0;
    function catchup(to) {
        result += text.substring(index, to);
        index = to;
    }
    
    function insert(text) {
        result+=text;
    }
    
    function skip(to) {
        index = to;
    }
    
    function visitNode(node) {
        catchup(node.getFullStart());
        switch (node.kind) {
            case ts.SyntaxKind.ExternalModuleReference:
                if (node.expression && node.expression.text) {
                    var referencePath = path.resolve(path.dirname(filePath), node.expression.text + '.d.ts');
                    if (map[referencePath]) {
                        insert(createRequire(map[referencePath]));
                        skip(node.getFullStart() + node.getFullWidth());
                        return;
                    } 
                }
                break;
            case ts.SyntaxKind.DeclareKeyword:
                skip(node.getFullStart() + node.getFullWidth());
                return;
            default:
                break;
        }

        ts.forEachChild(node, visitNode);
        catchup(node.getFullStart() + node.getFullWidth());
    }
    visitNode(sourceFile);
    
    result = 'declare module \'' + map[filePath] + '\' {\n\n' + result +'\n\n}';
    return result;
}

var imports = [];
var content = files.map(function (filePath) {
    var text = fs.readFileSync(filePath, 'UTF-8');
    var sourceFile = ts.createSourceFile(map[filePath], text, ts.ScriptTarget.Latest, '0');
    fixupParentReferences(sourceFile);
    return transformSourceFile(filePath, sourceFile, text, imports);
}).join('\n\n');


console.log(content);
