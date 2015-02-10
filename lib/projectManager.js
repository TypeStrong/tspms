'use strict';
var promise = require('./promise');
var ts = require('typescript');
var project = require('./project');
var utils = require('./utils');
var Logger = require('./logger');
var CompilerManager = require('./compilerManager');
var createProject = project.createProject;
//--------------------------------------------------------------------------
//
//  Internal API
//
//--------------------------------------------------------------------------
/**
 * The file system wrapper instance used by this module.
 */
var fileSystem;
/**
 * The working set service.
 */
var workingSet;
/**
 * A Map project name to ProjectInstance
 */
var projectMap = Object.create(null);
/**
 * Temp Project used for typescript file that are not managed by any registred project.
 */
var tempProject;
/**
 * Absolute filename of the directory opened in the editor.
 */
var currentDir;
/**
 * A promise queue used to insure async task are run sequentialy.
 */
var queue = utils.createPromiseQueue();
/**
 * Absolute fileName of the `lib.d.ts` file associated to the bundled compiler.
 */
var defaultLibFileName;
/**
 * A Map project name to project configuration
 */
var projectConfigs;
/**
 * Create projects from project configs in the projectConfigs Map.
 */
function createProjects() {
    return promise.Promise.all(Object.keys(projectConfigs).map(function (projectId) { return createProjectFromConfig(projectId, projectConfigs[projectId]); }));
}
/**
 * Dispose every projects created by the ProjectManager module.
 */
function disposeProjects() {
    Object.keys(projectMap).forEach(function (path) {
        projectMap[path].dispose();
    });
    projectMap = Object.create(null);
    if (tempProject) {
        tempProject.dispose();
        tempProject = null;
    }
}
/**
 * For given config and project name create a project.
 *
 * @param projectName the name of the project.
 * @param config the project config.
 */
function createProjectFromConfig(projectName, config) {
    var project = createProject(currentDir, config, fileSystem, workingSet);
    return project.init().then(function () {
        projectMap[projectName] = project;
    }, function () {
        Logger.error('could not create project:' + projectName);
    });
}
/**
 * Returns a temporary project for the given filename.
 * This method will try to reuse the curent temp project if any and if it manage the given fileName.
 *
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
function getTempProjectForFile(fileName) {
    //then we check if the current temp project has the file
    if (tempProject && tempProject.getProjectFilesSet()[fileName]) {
        return promise.Promise.resolve(tempProject);
    }
    if (tempProject) {
        tempProject.dispose();
        tempProject = null;
    }
    var config = {
        sources: [fileName],
        compilerOptions: {
            target: 2 /* Latest */,
            module: 1 /* CommonJS */,
            noLib: false
        }
    };
    tempProject = createProject(currentDir, config, fileSystem, workingSet);
    return tempProject.init().then(function () { return tempProject; });
}
//--------------------------------------------------------------------------
//
//  Public API
//
//--------------------------------------------------------------------------
/**
 * Initialize the ProjectManager module.
 *
 * @param config ProjectManager configuration
 */
function init(config) {
    defaultLibFileName = config.defaultLibFileName;
    workingSet = config.workingSet;
    fileSystem = config.fileSystem;
    projectConfigs = config.projectConfigs;
    CompilerManager.init(config.fileSystem, config.defaultLibFileName);
    return queue.reset(fileSystem.getCurrentDir().then(function (dir) {
        currentDir = dir;
        return createProjects();
    }));
}
exports.init = init;
/**
 * Dispose the ProjectManager module.
 */
function dispose() {
    queue.then(function () {
        disposeProjects();
        CompilerManager.dispose();
    });
}
exports.dispose = dispose;
/**
 * This function will try to find a project managing the given fileName.
 * It will first try to retrieve a project that have that file matching the `sources` configuration of the project.
 * Then it will try to retrieve a project where one of the sources files has a reference over the given file.
 * Finally if no project has been found a temp project will be instanciated/reused.
 *
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
function getProjectForFile(fileName) {
    return queue.then(function () {
        var projects = utils.getMapValues(projectMap);
        var project = null;
        //first we check for a project that have tha file as source 
        projects.some(function (tsProject) {
            if (tsProject.getProjectFileKind(fileName) === 1 /* SOURCE */) {
                project = tsProject;
                return true;
            }
        });
        //then we check if a project has a file referencing the given file
        if (!project) {
            projects.some(function (tsProject) {
                if (tsProject.getProjectFileKind(fileName) === 2 /* REFERENCE */) {
                    project = tsProject;
                    return true;
                }
            });
        }
        if (project) {
            return project;
        }
        return getTempProjectForFile(fileName);
    });
}
exports.getProjectForFile = getProjectForFile;
/**
 * This function will try to find all projects managing the given fileName.
 * If no project has been found a temp project will be instanciated/reused.
 *
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
function getAllProjectsForFile(fileName) {
    return queue.then(function () {
        var projects = utils.getMapValues(projectMap);
        //first we check for a project that have tha file as source 
        projects = projects.filter(function (project) { return project.getProjectFileKind(fileName) !== 0 /* NONE */; });
        if (projects.length) {
            return projects;
        }
        return getTempProjectForFile(fileName).then(function (project) { return [project]; });
    });
}
exports.getAllProjectsForFile = getAllProjectsForFile;
/**
 * Retrieve all projects managed by the project manager
 *
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
function getAllProjects() {
    return queue.then(function () {
        var result = utils.getMapValues(projectMap);
        if (tempProject) {
            result.push(tempProject);
        }
        return result;
    });
}
exports.getAllProjects = getAllProjects;
/*
 * Update / delete / create projects according to changes in project configs map.
 *
 * @param configs the new Map of TypeScriptProjectConfig
 */
function updateProjectConfigs(configs) {
    projectConfigs = configs;
    return queue.then(function () {
        var promises = [];
        Object.keys(projectMap).forEach(function (projectId) {
            var project = projectMap[projectId];
            var config = projectConfigs[projectId];
            if (!config) {
                project.dispose();
                delete projectMap[projectId];
            }
            else {
                promises.push(project.update(config));
            }
        });
        Object.keys(configs).forEach(function (projectId) {
            if (!projectMap[projectId]) {
                promises.push(createProjectFromConfig(projectId, projectConfigs[projectId]));
            }
        });
        return promise.Promise.all(promises);
    });
}
exports.updateProjectConfigs = updateProjectConfigs;
;
