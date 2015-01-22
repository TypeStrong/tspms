CC=node node_modules/.bin/tsc
FLAGS=--module commonjs --noImplicitAny --target ES5

JEST=node node_modules/.bin/jest 

OUT_DIR=built
RELEASE_DIR=lib
MAIN=src/main
DECLARATION=src/declarations
__TESTS__=src/main/__tests__

DECLARATIONS= $(DECLARATION)/core.d.ts $(DECLARATION)/minimatch.d.ts $(DECLARATION)/path.d.ts $(DECLARATION)/typescript.d.ts 

SOURCES= $(MAIN)/fileSystem.ts $(MAIN)/index.ts $(MAIN)/languageServiceHost.ts $(MAIN)/promise.ts $(MAIN)/project.ts $(MAIN)/projectManager.ts $(MAIN)/utils.ts $(MAIN)/workingSet.ts $(MAIN)/serviceUtils.ts

TESTS=$(DECLARATION)/jest.d.ts  $(__TESTS__)/fileSystemMock.ts $(__TESTS__)/workingSetMock.ts $(__TESTS__)/project-tests.ts $(__TESTS__)/languageServiceHost-test.ts $(__TESTS__)/projectManager-test.ts

GENERATED_DECLARATION=$(OUT_DIR)/index.d.ts $(OUT_DIR)/fileSystem.d.ts $(OUT_DIR)/promise.d.ts  $(OUT_DIR)/languageServiceHost.d.ts  $(OUT_DIR)/project.d.ts $(OUT_DIR)/projectManager.d.ts $(OUT_DIR)/utils.d.ts $(OUT_DIR)/workingSet.d.ts $(OUT_DIR)/serviceUtils.d.ts

GENERATED_JS=$(OUT_DIR)/index.js $(OUT_DIR)/fileSystem.js $(OUT_DIR)/promise.js $(OUT_DIR)/languageServiceHost.js $(OUT_DIR)/project.js $(OUT_DIR)/projectManager.js $(OUT_DIR)/utils.js $(OUT_DIR)/workingSet.js $(OUT_DIR)/serviceUtils.js 

all: test clean build 

release: clean_release generate_declaration copy_release

generate_declaration: $(GENERATED_DECLARATION) 
	node ./scripts/concat-declaration --moduleName typescript-project-services --mainFile $^ | sed 's/typescript-project-services\/built/typescript-project-services\/lib/g' > index.d.ts 
	
build: $(DECLARATIONS) $(SOURCES) 
	$(CC) $(FLAGS) -d $^ --outDir $(OUT_DIR)
    
build-test: $(DECLARATIONS) $(SOURCES) $(TESTS)
	$(CC) $(FLAGS) $^ --outDir $(OUT_DIR)

test: build-test
	$(JEST)

test_promise: build
	node ./node_modules/.bin/promises-aplus-tests ./scripts/promise-test-adapter.js

clean: 
	rm -rf $(OUT_DIR)
    
clean_release: 
	rm -rf $(RELEASE_DIR)/*
    
copy_release: $(GENERATED_JS)
	cp  $^ $(RELEASE_DIR)

    
    

