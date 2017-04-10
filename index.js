/* Copyright 2017 Paul Brewer, Economic and Financial Technology Consulting LLC */
/* This file is open source software.  The MIT License applies to this software. */

/* jshint esnext:true,eqeqeq:true,undef:true,lastsemic:true,strict:true,unused:true,node:true */

const promiseRetry = require('promise-retry');
const pipeToStorageFactory = require('pipe-to-storage');
const uuid = require('uuid').v4;

const backoffStrategy = {
    retries: 2,
    factor: 1.5,
    minTimeout:  1000,
    maxTimeout: 2000,
    randomize: true
};

const delay = 10*1000;

function wait(x){
    return new Promise(function(resolve){
	setTimeout(()=>(resolve(x)), delay);
    });
}


module.exports = function vaporlock(storage, maxTimeout){
    const timeout = maxTimeout || (600*1000);
    const pipeToStorage = pipeToStorageFactory(storage);
    return function(bucketName, fileName){
	const myid = uuid();
	let expires;
	function lockMetadata(){
	    expires = new Date(+Date.now()+timeout);
	    return {
		metadata: {
		    lockUntil: expires.toString(),
		    lockBy: myid
		}	
	    };
	}
	function F(){
	    return storage.bucket(bucketName).file(fileName);
	}
	function successfulLock(){
	    return {
		expires,
		unlock: ()=>{
		    if (Date.now()<=(expires-delay))
			return promiseRetry((retry)=>(F().delete().catch(retry))).then(()=>(true));
		    else
			return Promise.resolve(false);
		}
	    };
	}
	function attemptLock(){
	    return (pipeToStorage(myid, bucketName, fileName,{metadata: lockMetadata()})
		    .then(wait)
		    .then((expected)=>{
			return (promiseRetry((retry)=>(F().get().catch(retry)), backoffStrategy)
				.then((info)=>(info[1].md5Hash))
				.then((actual)=>{
				    if (expected.md5!==actual){
					throw new Error("failed lock attempt -- md5 mismatch");
				    } 
				})
			       );
		    })
		    .catch((e)=>{ throw new Error("failed lock attempt"); })
		   );
	}
	function attemptOverride(){
	    function getMetadata(){
		return (promiseRetry((retry)=>(F().getMetadata().catch(retry)), backoffStrategy)
			.then((info)=>(info[0].metadata))
		       );
	    }	
	    function assertExpired(){
		return (getMetadata()
			.then((metadata)=>(new Date(metadata.lockUntil)))
			.then((expires)=>{ if ((+Date.now())<(+expires)) throw new Error("failed lock attempt - unexpired lock"); })
		       );
	    }
	    function alterMetadata(){
		const newmeta = lockMetadata();
		return (promiseRetry((retry)=>(F().setMetadata(newmeta).catch(retry)), backoffStrategy)
			.then( ()=>(newmeta) )
		       );
	    }
	    function checkMetadata(){
		return (getMetadata()
			.then((actual)=>{ if (myid!==actual.lockBy) throw new Error("failed lock attempt - lockBy id mismatch"); })
		       );
	    }
	    return (assertExpired()
		    .then(alterMetadata)
		    .then(wait)
		    .then(checkMetadata)
		   );
	}
	return (promiseRetry((retry)=>(F().exists().then((info)=>(info[0])).catch(retry)), backoffStrategy)
		.then((isLocked)=>((isLocked)? (attemptOverride()) : (attemptLock())))
		.then(successfulLock)
	       );
    }
};
