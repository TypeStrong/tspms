/*jshint node: true */
module.exports = function (grunt) {
    'use strict';
    
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-typescript');
    grunt.loadNpmTasks('grunt-exec');
    
    
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        
        dirs: {
            main: 'src/main',
            declarations: 'src/declarations',
            built: './built',
            lib: './lib'
        },
        
        clean: {
            built: '<%= dirs.built %>',
            lib: '<%= dirs.lib %>',
            declarations: '<%= dirs.lib %>/*.d.ts'
        },
        
        typescript: {
            options: {
                compiler: './node_modules/typescript/bin/tsc',
                target: 'es5',
                module: 'commonjs',
                noImplicitAny: true,
                preserveConstEnums: true,
                noLib: true,
                basePath: '<%= dirs.main %>'
            },
            
            dev: {
                src: ['<%= dirs.declarations %>/*.d.ts', '<%= dirs.main %>/**/*.ts'],
                dest: '<%= dirs.built %>',
                options: {
                    sourceMap: false,
                    declaration: false
                }
            },
            
            release: {
                src: ['<%= typescript.dev.src %>', '!<%= dirs.declarations %>/jes.d.ts', '!<%= dirs.main %>/__tests__/**/*.ts'],
                dest: '<%= dirs.lib %>',
                options: {
                    sourceMap: false,
                    declaration: true
                }
            },
            
            generate_doc: {
                src: ['scripts/generate-doc.ts'],
                dest: 'scripts',
                options: {
                    sourceMap: false,
                    noImplicitAny: false,
                    preserveConstEnums: false,
                    noLib: false,
                    basePath: 'scripts'
                }
            }
        },
        
        exec: {
            jest: './node_modules/.bin/jest',
            jest_coverage: './node_modules/.bin/jest --coverage',
            jest_debug: 'node --debug-brk --harmony ./node_modules/.bin/jest --runInBand',
            test_promise: 'node ./node_modules/.bin/promises-aplus-tests ./scripts/promise-test-adapter.js',
            concat_declarations: {
                command: function () {
                    var declarationFiles = grunt.file.expand(['lib/*.d.ts', '!lib/index.d.ts']);
                    var cmd = (
                        "node ./scripts/concat-declaration " + 
                        "--moduleName tspms " +
                        "--mainFile lib/index.d.ts " +
                        declarationFiles.join(' ') +
                        "> ./index.d.ts "
                    );
                    console.log(cmd);
                    return cmd;
                }
            },
            generate_doc: {
                command: function () {
                    var src = grunt.file.expand([
                        'src/declarations/*.d.ts', 
                        'src/main/**/*.ts',
                        '!src/main/index.d.ts'
                    ]);
                    var cmd = (
                        "node ./scripts/generate-doc " + 
                        "--moduleName tspms " +
                        "--docDir ./doc " +
                        "--mainFile src/main/index.ts " +
                        src.join(' ') +
                        "> ./doc/API.md"
                    );
                    console.log(cmd);
                    return cmd;
                }
            }
        }
        
    });
    
    grunt.registerTask('test', 'exec:jest');
    grunt.registerTask('coverage', 'exec:jest_coverage');
    grunt.registerTask('test-debug', 'exec:jest_debug');
    grunt.registerTask('generate_doc', ['typescript:generate_doc', 'exec:generate_doc']);
    
    grunt.registerTask('release', ['clean:lib', 'typescript:release', 'exec:concat_declarations', 'clean:declarations', 'generate_doc' ]);
    grunt.registerTask('test-promise', ['clean:built', 'typescript:dev','exec:test_promise' ]);
    
    grunt.registerTask('default', ['clean:built', 'typescript:dev', 'test']);
    
};