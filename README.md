# vaporlock

[![Build Status](https://travis-ci.org/DrPaulBrewer/vaporlock.svg?branch=master)](https://travis-ci.org/DrPaulBrewer/vaporlock)

Experimental advisory locking system built on Google Cloud Storage [tm]

## Summary

### Important

An **advisory lock does not prevent anyone from modifying or reading anything** but is simply a test your software
can run to confirm that it is the only one (hopefully) that passes the test until the lock expires or is deleted.

### Bad:

1. Locking is slow. Too slow for interactive front end systems.  It can take 10-15 seconds to get a lock although
failures might be identified in 1-2 seconds.

1. Since Google Cloud Storage[tm] is probably not atomic, this locking scheme could fail and allow multiple
tasks through to critical code.  Nevertheless, this locking could stll be useful in reducing wasted effort on
duplicate cloud triggers provided that accidentally executing two triggers simulataneously either produces
an accpetable result or is detectable later.

1. Keep in mind that the locking might only fail under heavily loaded, or long latency conditions, or simply when you really, really need it to work.
Also see [wikipedia: Peter Principle](https://en.wikipedia.org/wiki/Peter_principle) and [wikipedia: Murphys Law](https://en.wikipedia.org/wiki/Murphy%27s_law)

### Good:

1. Locks have a definite expiration time.
1. Expired locks don't slow anyone down: the lock is identified as expired and a new lock obtained.
1. The default expiration is 600 sec (10 minutes), but you can set a different expiration.

### How it Works

Read the source code to answer any questions not answered here.

A lock request tests if the indicated file exists.

#### The lock file does not exist

If the file does not exist, then we calculate the md5 hash of a unique id and write the unique id to the cloud file
along with a metadata request to also set the uuid and lock expiration time as file metadata fields.

Google Cloud Storage independently calculates a md5 hash when storing the file, or other files that may overwrite
this one due to concurrent attempts to establish the same lock. After waiting 10 seconds, we compare the md5 hash
of the file reported by Google Cloud Storage metadata to the md5 we wrote.  If the md5s match, we have the lock.

#### The lock file exists

If the file exists, then the lock expiration time is read from the file metadata.  If the lock has expired, then
a unique id and the new expiration time are written to the file metadata only.  After waiting 10 seconds, the
file metadata is read back, our unique id is checked against the metadata unique id.  If the ids match, we have the lock.

#### Failures

I/O errors are retried.  Mismatches are not.  A mismatch of md5s, or unique ids, throws an error yielding a rejected `Promise`.

The wait time needs to be longer than the maximum expected i/o retry time plus the settlement time for cloud storage to become
"eventually consistent".

### Understanding the Gamble

The gamble a developer must evaluate is whether the costs of errors made by this locking scheme are less than 
the value captured by using it.  This gamble is solely your responsibility to evaluate.  For example, you can write additional
tests for this module or use it in a small-scale prototype before attempting to use it in production.  In some use cases, errors with locking
are disastrous or otherwise unacceptable and in such a case you should use something else.  Whether the accuracy can be improved
by lengthening the wait time is unclear as the storage mechanism is not atomic and need not yield consistent data to each client testing a lock.

## Installation

    npm i vaporlock -S

## Initialization

    const storage = require('@google-cloud/storage', {optional_api_key});

**Pass the storage object** and your desired expiration time when initializing.

    const vaporlock = require('vaporlock')(storage, 300*1000);  // will request 300 sec = 5 minute locks

## Usage

### Decide on a rendezvous point

All tasks desiring to implement lock testing, for a paticular section of code or resource, need to agree on a bucket/file to test.

    const bucket = 'somestoragebucket'; // no "gs://" 
    const file = 'mylockfile';


### Locks

Attempting a lock returns a `Promise`.

The `Promise` resolves on a successful lock and rejects on unsuccessful locks.

    (vaporlock(bucket,file)
    .then(function(lock){

        // sensitive or resource-intensive code goes here
	
        // lock.expires is the expiration date/time, which can be compared to Date.now()
	// when done with task, lock.unlock() returns a Promise that clears the lock
	return lock.unlock();
     })
     )


# Copyright

Copyright 2017 Paul Brewer, Economic and Financial Technology Consulting LLC <drpaulbrewer@eaftc.com>

# License

The MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Trademarks

Google Cloud Storage [tm] is a trademark of Google, Inc.

This software is not a product of Google, Inc.
