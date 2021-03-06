'use strict';

const fs = require('fs');
const readline = require('readline');
const sinon = require ('sinon');
const tap = require('tap');

const inquire = require('../src/inquire');
const utils = require('../src/utils');

const mockReadline = {
    close: sinon.spy(),
    question: sinon.spy(),
    write: sinon.spy()
};

let mockAnswersPath;
let mockCreateInterface;
let mockFsExists;
let mockFsReadFile;
let mockFsWriteFile;

tap.test('.inquire', (suite) => {
    suite.beforeEach((done) => {
        mockAnswersPath = sinon.stub(utils, 'getAnswersPath');
        mockCreateInterface = sinon.stub(readline, 'createInterface');
        mockFsExists = sinon.stub(fs, 'existsSync');
        mockFsReadFile = sinon.stub(fs, 'readFileSync');
        mockFsWriteFile = sinon.stub(fs, 'writeFileSync');

        mockAnswersPath.returns('baba booey');
        mockCreateInterface.returns(mockReadline);

        done();
    });

    suite.afterEach((done) => {
        mockAnswersPath.restore();
        mockCreateInterface.restore();
        mockFsExists.restore();
        mockFsReadFile.restore();
        mockFsWriteFile.restore();

        mockReadline.close.reset();
        mockReadline.question.reset();
        mockReadline.write.reset();

        done();
    });

    suite.test('should create a new readline interface', (test) => {
        test.plan(3);

        inquire([]);

        // same == equivalent
        const config = mockCreateInterface.firstCall.args[0];
        test.equal(typeof config.completer, 'function');
        test.equal(config.input, process.stdin);
        test.equal(config.output, process.stdout);

        test.end();
    });

    suite.test('should get the answers path and see if the .erector file exists', (test) => {
        test.plan(2);

        inquire([]);

        test.ok(mockAnswersPath.called);
        test.equal(mockFsExists.lastCall.args[0], 'baba booey');

        test.end();
    });

    suite.test('should parse the .erector file if it exists', (test) => {
        const mockParse = sinon.stub(JSON, 'parse');

        test.plan(1);

        mockFsExists.returns(true);
        mockFsReadFile.returns('fafa flo fly');
        mockParse.returns([]);

        inquire([]);

        test.same(mockFsReadFile.lastCall.args, ['baba booey', 'utf8']);

        mockParse.restore();
        test.end();
    });

    suite.test('should close the readline interface if no questions are provided', (test) => {
        test.plan(1);

        inquire([]).then(() => {
            test.ok(mockReadline.close.called);
            test.end();
        });
    });

    suite.test('should ask the a question if the `question` attribute exists on the question object', (test) => {
        const questions = [
            { question: '  Do you like food?                ' }
        ];

        test.plan(1);

        inquire(questions);

        // need to call the reader.question callback
        mockReadline.question.lastCall.args[1]('test');

        test.equal(mockReadline.question.lastCall.args[0], 'Do you like food? ');
        test.end();
    });

    suite.test('should pre-populate the answer if a previous answer exists', (test) => {
        const questions = [
            { question: 'Do you like food?', name: 'food' }
        ];
        const mockParse = sinon.stub(JSON, 'parse');

        test.plan(1);

        mockFsExists.returns(true);
        mockParse.returns([
            { answer: 'N', name: 'food' }
        ]);

        inquire(questions);

        test.equal(mockReadline.write.lastCall.args[0], 'N');
        test.end();

        mockFsExists.returns(false);
        mockParse.restore();
    });

    suite.test('should use a defaultAnswer if provided', (test) => {
        const questions = [
            { defaultAnswer: 'Darn tootin!', question: 'Do you like food?', name: 'food' }
        ];

        test.plan(1);

        inquire(questions);

        test.equal(mockReadline.question.lastCall.args[0], 'Do you like food (Darn tootin!)? ');
        test.end();
    });

    suite.test('should use call a defaultAnswer function if provided', (test) => {
        const defaultSub = sinon.stub({ stubby() {} }, 'stubby', () => 'Functional...');
        const questions = [
            { defaultAnswer: defaultSub, question: 'Do you like food?', name: 'food' }
        ];

        test.plan(2);

        inquire(questions);

        test.deepEqual(defaultSub.lastCall.args[0], []);
        test.equal(mockReadline.question.lastCall.args[0], 'Do you like food (Functional...)? ');
        test.end();
    });

    suite.test('should call a transform for a previous answer if it is provided', (test) => {
        const questions = [
            { question: 'Do you like food?', name: 'food' }
        ];
        const mockParse = sinon.stub(JSON, 'parse');
        const transforms = {
            food: sinon.mock().returns('Y')
        };

        test.plan(3);

        mockFsExists.returns(true);
        mockParse.returns([
            { answer: true, name: 'food' }
        ]);

        inquire(questions, false, transforms);

        test.ok(transforms.food.calledOnce);
        test.ok(transforms.food.calledWith(true));
        test.equal(mockReadline.write.lastCall.args[0], 'Y');
        test.end();

        mockFsExists.returns(false);
        mockParse.restore();
    });

    suite.test('should ask multiple questions', (test) => {
        const questions = [
            { question: 'Do you like food?', name: 'food' },
            { question: 'What kind of food?', name: 'kinds' }
        ];

        test.plan(2);

        const promise = inquire(questions);
        mockReadline.question.lastCall.args[1]('Y');

        // we run the setTimeout because there are nested Promises at work
        setTimeout(() => {
            test.ok(mockReadline.question.calledTwice);
            test.equal(mockReadline.question.lastCall.args[0], 'What kind of food? ');
            test.end();
        });
    });

    suite.test('should ask the question again if the answer is NOT valid', (test) => {
        const questions = [
            { question: 'Do you like food?', name: 'food' }
        ];

        test.plan(2);

        inquire(questions);
        mockReadline.question.lastCall.args[1]();

        setTimeout(() => {
            test.ok(mockReadline.question.calledTwice);
            test.equal(mockReadline.question.lastCall.args[0], 'Do you like food? ');
            test.end();
        });
    });

    suite.test('should ask the question again if the answer is null', (test) => {
        const questions = [
            { question: 'Do you like food?', name: 'food' }
        ];

        test.plan(2);

        inquire(questions);
        mockReadline.question.lastCall.args[1](null);

        setTimeout(() => {
            test.ok(mockReadline.question.calledTwice);
            test.equal(mockReadline.question.lastCall.args[0], 'Do you like food? ');
            test.end();
        });
    });

    suite.test('should ask the question again if the answer is undefined', (test) => {
        const questions = [
            { question: 'Do you like food?', name: 'food' }
        ];

        test.plan(2);

        inquire(questions);
        mockReadline.question.lastCall.args[1](undefined);

        setTimeout(() => {
            test.ok(mockReadline.question.calledTwice);
            test.equal(mockReadline.question.lastCall.args[0], 'Do you like food? ');
            test.end();
        });
    });

    suite.test('should resolve the question Promise if the answer is a valid string', (test) => {
        const questions = [
            { question: 'Do you like food?', name: 'food' }
        ];

        test.plan(1);

        const promise = inquire(questions);

        mockReadline.question.lastCall.args[1]('Y');

        promise.then((answers) => {
            test.same(answers, [
                { answer: 'Y', name: 'food' }
            ]);
            test.end();
        });
    });

    suite.test('should resolve the question Promise if the answer is a non-null, non-undefined, non-string', (test) => {
        const questions = [
            { question: 'Do you like food?', name: 'food' }
        ];

        test.plan(1);

        const promise = inquire(questions);

        mockReadline.question.lastCall.args[1](12);

        promise.then((answers) => {
            test.same(answers, [
                { answer: 12, name: 'food' }
            ]);
            test.end();
        });
    });

    suite.test('should resolve the question Promise if a blank answer is valid', (test) => {
        const questions = [
            { allowBlank: true, question: 'Do you like food?', name: 'food' }
        ];

        test.plan(1);

        const promise = inquire(questions);

        mockReadline.question.lastCall.args[1]('');

        promise.then((answers) => {
            test.same(answers, [
                { answer: '', name: 'food' }
            ]);
            test.end();
        });
    });

    suite.test('should use an answer to answer another question if the useAnswer attribute is set', (test) => {
        const questions = [
            { question: 'What is you favorite food?', name: 'fav' },
            { name: 'derived', useAnswer: 'fav' }
        ];

        test.plan(1);

        const promise = inquire(questions);

        mockReadline.question.firstCall.args[1]('pizza');

        promise.then((answers) => {
            test.same(answers, [
                { answer: 'pizza', name: 'fav' },
                { answer: 'pizza', name: 'derived' }
            ]);
            test.end();
        });
    });

    suite.test('should use a blank to answer a question if the useAnswer attribute is set to an unknown answer name', (test) => {
        const questions = [
            { question: 'What is you favorite food?', name: 'fav' },
            { name: 'derived', useAnswer: 'favorite' }
        ];

        test.plan(1);

        const promise = inquire(questions);

        mockReadline.question.firstCall.args[1]('pizza');

        promise.then((answers) => {
            test.same(answers, [
                { answer: 'pizza', name: 'fav' },
                { answer: '', name: 'derived' }
            ]);
            test.end();
        });
    });

    suite.test('should utilize a transform function if one is provided', (test) => {
        const questions = [
            { question: 'What is you favorite food?', name: 'fav' },
            { name: 'derived', transform: (value) => `${value} is the best!`, useAnswer: 'fav' }
        ];

        test.plan(1);

        const promise = inquire(questions);

        mockReadline.question.firstCall.args[1]('pizza');

        promise.then((answers) => {
            test.same(answers, [
                { answer: 'pizza', name: 'fav' },
                { answer: 'pizza is the best!', name: 'derived' }
            ]);
            test.end();
        });
    });

    suite.test('should write the .erector file on a successful inquiry', (test) => {
        const questions = [
            { question: 'What is you favorite food?', name: 'fav' }
        ];
        const mockStringify = sinon.stub(JSON, 'stringify');

        mockStringify.returns('tata toothy');

        test.plan(1);

        const promise = inquire(questions, true);

        mockReadline.question.firstCall.args[1]('pizza');

        promise.then(() => {
            test.same(mockFsWriteFile.lastCall.args, [
                'baba booey',
                'tata toothy',
                { encoding: 'utf8' }
            ]);
            mockStringify.restore();
            test.end();
        });

    });

    suite.test('should not write to the .erector file', (test) => {
        const questions = [
            { question: 'What is you favorite food?', name: 'fav' }
        ];
        test.plan(1);

        const promise = inquire(questions);

        mockReadline.question.firstCall.args[1]('pizza');

        promise.then(() => {
            test.ok(mockFsWriteFile.notCalled);
            test.end();
        });

    });

    suite.done();
});

