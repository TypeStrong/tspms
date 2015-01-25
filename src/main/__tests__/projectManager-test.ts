'use strict';

jest.dontMock('../projectManager');
jest.dontMock('../utils');
jest.dontMock('./fileSystemMock');

import projectManager = require('../projectManager');
import TypeScriptProject = require('../project');
import utils = require('../utils');
import FileSystemMock = require('./fileSystemMock');
import promise  = require('../promise');
import Promise  = promise.Promise;
import ts = require('typescript');

 type ProjectConfig = {
    sources?: string[];
    compilationSettings?: ts.CompilerOptions;

    /**
     * Path to an alternative typescriptCompiler
     */
    typescriptPath?: string;
} 

describe('TypeScriptProjectManager', function () {
    var fileSystemMock: FileSystemMock,
        projectSpy: {
            init: jest.Mock<Promise<void>>;
            update: jest.Mock<Promise<void>>;
            dispose: jest.Mock<void>;
        },
        createProjectMock = <jest.Mock<any>>TypeScriptProject.createProject
    
    
   
    
    function initiProjectManager(
        projectConfigs: { [projectId: string]: ProjectConfig; },
        files?: { [fileName: string]: string; }
    ) {
        fileSystemMock = new FileSystemMock();
        if (typeof files !== 'undefined') {
             fileSystemMock.setFiles(files)
        }
        projectManager.init({
            projectConfigs: (<any> projectConfigs),
            defaultTypeScriptLocation: 'lib.d.ts',
            fileSystem: fileSystemMock,
            workingSet: null
        });
    }
    
    beforeEach(function () {
        projectSpy = {
            init: jest.genMockFn<Promise<void>>(),
            update: jest.genMockFn<Promise<void>>(),
            dispose: jest.genMockFn<void>(),
        }
        
        projectSpy.init.mockReturnValue(Promise.resolve())
        projectSpy.update.mockReturnValue(Promise.resolve())
        projectSpy.dispose.mockReturnValue(void 0);
        
        createProjectMock.mockReturnValue(projectSpy);
    });
            
    
    afterEach(function () {
        projectManager.dispose();
        createProjectMock.mockClear();
    });
    
    describe('init', function () {
        it('should create a new Project for each project config pushed by the preferenceManager', function () {

         
            initiProjectManager({
                project1: { },
                project2: { }
            });
           
            jest.runAllTimers();
            expect(createProjectMock.mock.calls.length).toBe(2);
        });

       
        
        
        it('should dispose all registred project when disposed', function () {


            initiProjectManager({
                default: {}
            });
            projectManager.dispose();
            jest.runAllTimers();
            expect(projectSpy.dispose.mock.calls.length).toBe(1);
        });
    });
    
    describe('updateProjectConfigs', function () {
        it('should dispose projects that have no more config when config changes', function () {

         
            initiProjectManager({
                project1: {},
                project2: {}
            });
            
            jest.runAllTimers();
            
            projectManager.updateProjectConfigs(<any>{
                project1: {}
            })

            
            jest.runAllTimers();
           
            expect(projectSpy.dispose.mock.calls.length).toBe(1); 
        });
        
        
        it('should create projects that have been added in the config', function () {

         
            initiProjectManager({
                project1: {},
                project2: {}
            });
            
            projectManager.updateProjectConfigs(<any>{
                project1: {},
                project2: {},
                project3: {}
            });
            
            jest.runAllTimers();
            expect(createProjectMock.mock.calls.length).toBe(3);
        });
        
        
        it('should update other projects', function () {

         
            initiProjectManager({
                project1: {},
                project2: {}
            });
            jest.runAllTimers();
            
            projectManager.updateProjectConfigs(<any>{
                project1: {},
                project2: {}
            });
            
            jest.runAllTimers();
            expect(projectSpy.update.mock.calls.length).toBe(2); 
        });
        
        
    });
    
    
    
    describe('getProjectForFiles', function () { 
        beforeEach(function () {
            (<any>jest).useRealTimers();
            var i = 0;
            createProjectMock.mockImpl(function () {
                var project = <any>utils.clone(projectSpy);
                project.id = i++;
                project.getProjectFileKind = function (file: string) {
                    var map: {[index: string]: TypeScriptProject.ProjectFileKind};
                    if (project.id === 0) {
                        map = {
                            '/file1.ts': TypeScriptProject.ProjectFileKind.SOURCE,
                            '/file2.ts': TypeScriptProject.ProjectFileKind.REFERENCE,
                            '/file3.ts': TypeScriptProject.ProjectFileKind.NONE,
                            '/file4.ts': TypeScriptProject.ProjectFileKind.NONE,
                            '/file5.ts': TypeScriptProject.ProjectFileKind.NONE
                        };
                    } else if (project.id === 1) {
                        map = {
                            '/file1.ts': TypeScriptProject.ProjectFileKind.NONE,
                            '/file2.ts': TypeScriptProject.ProjectFileKind.SOURCE,
                            '/file3.ts': TypeScriptProject.ProjectFileKind.NONE,
                            '/file4.ts': TypeScriptProject.ProjectFileKind.REFERENCE,
                            '/file5.ts': TypeScriptProject.ProjectFileKind.NONE
                        };
                    }
                    return map[file];
                },
                project.getProjectFilesSet = () => ({
                    '/file3.ts': true
                });
                return project;
            });
            
            

            
            initiProjectManager({
                project1: {
                    compilationSettings: {
                      module: ts.ModuleKind.AMD  
                    },
                    sources: [
                        './file1.ts'
                    ],
                    outDir: 'bin'
                },
                project2: {
                    compilationSettings: {
                      module: ts.ModuleKind.CommonJS  
                    },
                    sources: [
                        './file2.ts'
                    ],
                    outFile: 'index.js'
                }
            },{
                '/file1.ts': 'import file1 = require("file2")',
                '/file2.ts': 'import file4 = require("file4")',
                '/file3.ts': '',
                '/file4.ts': ''
            });
        });
        
        afterEach(function () {
            (<any>jest).useFakeTimers();
        })
        
        pit('should return a project that have the file as source if this project exist ', function () {
            return projectManager.getProjectForFile('/file2.ts').then((project: any) => {
                expect(project.id).toBe(1);  
            });
        });
        
        pit('should return a project that have the file has reference if this project ' +
                'exist and no project has the file as source', function () {
            return projectManager.getProjectForFile('/file4.ts').then((project: any) => {
                expect(project.id).toBe(1);  
            });
        });
        
        
        pit('should return a temp project if no project has file as source or reference', function () {
            return projectManager.getProjectForFile('/file3.ts').then((project: any) => {
                expect(project.id).toBe(2);  
            });
        });
        
        pit('should recreate a temp project if no project has file as source or reference nor the temp project', function () {
            return projectManager.getProjectForFile('/file5.ts').then(function () {
                return projectManager.getProjectForFile('/file5.ts').then((project: any) => {
                    expect(project.id).toBe(3);  
                });
            });
        });

        pit('should not recreate a temp project if the temp project has file as source or reference', function () {
            return projectManager.getProjectForFile('/file3.ts').then(function () {
                return projectManager.getProjectForFile('/file3.ts').then((project: any) => {
                    expect(project.id).toBe(2);  
                });
            })
            
        });
    });
    
});