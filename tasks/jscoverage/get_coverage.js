var system = require('system');

if (system.args.length > 1) {
    jscoverage_server = system.args[1];
} else {
    jscoverage_server = "localhost:9999";
}

var tests = ['jasmine', 'mocha'];

runTests(tests.pop());

function done(test) {
    
    if (tests.length === 0) {
        phantom.exit();
    } else {
        runTests(tests.pop());
    }
}

function runTests(test) {
    console.log("running " + test + " tests...");
    
    var jscoverage_url = "http://" + jscoverage_server + "/jscoverage.html?test/"+ test +"/index.html",
        page = require('webpage').create(),
        timer;

    console.log(jscoverage_url);

    //open test runner
    page.open(jscoverage_url, function (status) {
        if (status === "success") {
            //wait for tests to run and trigger storage of reports
            //here we wait 15 seconds
            timer = setTimeout(function () {
                clearTimeout(timer);
                done(test);
            }, 15000);
            
        } else {
            console.log("Failed to open URL: " + jscoverage_url + "err code: " + status);
        }
    });
}
