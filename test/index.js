/* jshint node:true,mocha:true,esnext:true,eqeqeq:true,undef:true,lastsemic:true */

const assert = require('assert');
require('should');

const storage = require('@google-cloud/storage')({
    projectId: 'eaftc-open-source-testing',
    keyFilename: './test/storage.json'
});

const vaporlock = require("../index.js")(storage,60*1000);

const bucket = 'eaftc-travis-testing';
const fname = 'lock';

const fs = require('fs');

function locksObtained(n, clear, expected){
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
    return (Promise
	    .all(win.map((x,j)=>{ return vaporlock(bucket, 'lockfile').then( claim(j), ignore ); }))
	    .then(function(){
		let i,l,sum=0;
		for(i=0,l=win.length;i<l;++i) sum += win[i];
		if (sum!==expected) throw new Error("expected "+expected+" locks, obtained: "+sum);
	    })
	   );
}

describe('vaporlock', function(){
    it('should only show 1 winner with 2 concurrent', function(){
	return locksObtained(2, true, 1);
    });
    it('should only show 1 winner with 5 concurrent', function(){
	return locksObtained(5, true, 1);
    });
    it('should only show 1 winner with 10 concurrent', function(){
	return locksObtained(10, true, 1);
    });
    it('should only show 1 winner with 2 concurrent, unreleased lock', function(){
	return locksObtained(2, false, 1);
    });
    it('should not show any locks because the old lock is unreleased', function(){
	return locksObtained(10, true, 0);
    });
    it('wait 1 minute + 10 seconds ', function(done){
	setTimeout(done, 70*1000);
    });
    it('should only show 1 winner with 10 concurrently attempting override of expired lock', function(){
	return locksObtained(10,true,1);
    });
});


