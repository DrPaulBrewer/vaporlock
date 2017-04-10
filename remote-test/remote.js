/* jshint node:true,esnext:true,eqeqeq:true,undef:true,lastsemic:true */

const assert = require('assert');
require('should');

const storage = require('@google-cloud/storage')({
    projectId: 'eaftc-open-source-testing',
    keyFilename: './test/storage.json'
});

const vaporlock = require("../index.js")(storage,60*1000);

const bucket = 'eaftc-travis-testing';
const fname = 'lockremote';

const fs = require('fs');

const resultsFile = "./results.csv";
const location = process.env.location;

fs.appendFileSync(resultsFile, "location,start,finish,obtained,error\n");

function locksObtained(n, clear){
    const win = new Array(n).fill(false);
    function ignore(){}
    function log(e){ console.log(e); }
    function claim(j){
	return function(lock){
	    win[j] = true;
	    if (clear)
		return lock.unlock();
	};
    }
    const now = Date.now();
    return (Promise
	    .all(win.map((x,j)=>{ return vaporlock(bucket, fname).then( claim(j), ignore ); }))
	    .then(function(){
		let i,l,sum=0;
		for(i=0,l=win.length;i<l;++i) sum += win[i];
		fs.appendFileSync(resultsFile, [location, now, Date.now(), sum].join(",")+"\n", {encoding:'utf8'});
	    },function(){
		fs.appendFileSync(resultsFile, [location, now, Date.now(), 0, "Error"].join(",")+"\n", {encoding:"utf8"});
	    })
	   );
}

function loop(){
    function again(){
	return locksObtained(2, true).then(loop);
    }
    const now = Date.now();
    const every = 200*1000;
    const next = Math.ceil(now/every)*every;
    setTimeout(again, next-now);    
}

loop();

