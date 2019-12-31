const pending = 'pending'
const resolved = 'resolved'
const rejected = 'rejected'

window.log = console.log

// 处理 then/catch 中的返回值
function resolvePromise(backPromise, value, resolve, reject){
  // 防止返回的Promise既能调resolve，又能调reject
  let isCalled = false

  // 无论返回值是对象还是函数，只要有then方法
  if(
    value && 
    (typeof value === 'function' || typeof value === 'object') &&
    value.then &&
    typeof value.then === 'function'
  ){
    try {
      // 如果返回的Promise有自己的then方法，则先执行自己的，再执行自定义的，如果自己的then又返回一个Promise，则递归调用
      value.then.call(value,
        (res)=> {
          if(isCalled) return
          isCalled = true
          resolvePromise(backPromise, res, resolve, reject)
        },
        (err)=> {
          if(isCalled) return
          isCalled = true
          reject(err)
        }
      )
    } catch (err) {
      if(isCalled) return
      isCalled = true
      reject(err)
    }
  } else {
    // 如果没有返回值，或者返回值不是带有 then 方法的函数或对象，将返回一个 resolved 的 Promise
    resolve(value)
  }
}

class WPromise {
  constructor(cb){

    this.status = pending
    this.value = undefined

    // 存储多个 then 方法的所有回调
    this.resolvedCallbacks = []
    this.rejectedCallbacks = []

    const resolve = res => {
      if(this.status === 'pending'){
        this.status = resolved
        this.value = res
        this.resolvedCallbacks.map(func => func())
      }
    }
    const reject = res => {
      if(this.status === 'pending'){
        this.status = rejected
        this.value = res
        this.rejectedCallbacks.map(func => func())
      } 
    }
    try {
      cb(resolve, reject)
    } catch(err) {
      reject(err)
    }
  }
  then(onFulfilled, onRejected){
    // 首先判断参数是不是 function 如果不是则使用默认函数(ersolve直接返回参数) 继续向后执行
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : res => res
    onRejected = typeof onRejected === 'function' ? onRejected : err => {throw err}
    
    // then/catch 返回值也是一个 Pormise
    const backPromise =  new WPromise((resolve, reject) => {
      switch(this.status) {
        case pending : {
          this.resolvedCallbacks.push(()=>{
            setTimeout(()=>{
              try {
                const res = onFulfilled(this.value)
                resolvePromise(backPromise, res, resolve, reject)
              } catch (err){
                reject(err)
              }
            })
          })
          this.rejectedCallbacks.push(()=>{
            setTimeout(()=>{
              try {
                const res = onRejected(this.value)
              } catch (err) {
                reject(err)
              }
            })
          })
          break
        }
        case resolved : {
          setTimeout(()=>{
            try {
              const res = onFulfilled(this.value)
              resolvePromise(backPromise, res, resolve, reject)
            } catch (err){
              reject(err)
            }
          })
          break
        }
        case rejected : {
          setTimeout(()=>{
            try {
              const res = onRejected(this.value)
              resolvePromise(backPromise, res, resolve, reject)
            } catch (err) {
              reject(err)
            }
          })
          break
        }
      }
    })
    return backPromise
  }
  catch(onRejected){
    return this.then(null, onRejected)
  }
  /* 
  * finally的回调函数不接受参数
  * finally的的参数如果不是函数，则执行空函数
  * 处理 finally 的返回值，直接将当前Promise的状态传递给后方
  */
  finally(cb){
    if(typeof cb !== 'function') cb = () => {}
    return this.then(
      res => new WPromise((resolve,reject)=>{
        cb()
        resolve(res)
      }),
      err =>  new WPromise((resolve,reject)=>{
        cb()
        reject(err)
      }),
    )
  }
  /* 
  * Promise.resolve()
  * 如果是 Promise,直接返回这个 Promise
  * 如果是具有 then 方法的对象，执行自己的 then 方法, 并接收resolve, reject两个参数
  * 其他直接返回一个 resolved 的 Promise
  */
  static resolve(value){
    if(value instanceof this) return value
    return new WPromise((resolve, reject)=>{
      if(value && value.then && typeof value.then === 'function'){
        value.then(resolve, reject)
      } else {
        resolve(value)
      }
    })
  }
  /* 
  * Promise.reject()
  * 直接返回一个 rejected 的 Promise
  */
  static reject(value){
    return new WPromise((resolve, reject)=>{
      reject(value)
    })
  }
  /* 
  * Promise.all()
  * 如果 没有参数或 / 参数不是一个可迭代的数据结构 直接执行 catch 方法
  * 如果参数 length 为0，直接执行 then 方法
  */
  static all(iterator){
    return new WPromise((resolve, reject)=>{
      if(!iterator[Symbol.iterator]) {
        reject()
        return
      }
      if(!iterator.length){
        resolve()
        return
      }
      let resolveArr = []

      iterator.map(item => WPromise.resolve(item)).forEach(promise => {
        promise.then((res)=>{
          resolveArr.push(res)
          if(resolveArr.length === iterator.length){
            resolve(resolveArr)
          }
        },reject)
      })
    })
  }
  /* 
  * Promise.race()
  */
  static race(iterator){
    return new WPromise((resolve, reject)=>{
      if(!iterator[Symbol.iterator]) {
        reject()
        return
      }
      if(!iterator.length){
        resolve()
        return
      }
      iterator.map(item => WPromise.resolve(item)).forEach(promise => {
        promise.then(resolve,reject)
      })
    })
  }
}
