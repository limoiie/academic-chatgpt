if (!IN_TAURI) {
  injectTauriHttpInvoke();
}

function injectTauriHttpInvoke() {
  // @ts-ignore
  window.__TAURI_IPC__ = function (message: any) {
    postMessage(message);
  };

  window.__TAURI_INVOKE__ = function invoke(cmd, args = {}) {
    return new Promise(function (resolve, reject) {
      const callback = transformCallback(function (r: any) {
        resolve(r);
        // @ts-ignore
        delete window[`_${error}`];
      }, true);
      const error = transformCallback(function (e: any) {
        reject(e);
        // @ts-ignore
        delete window[`_${callback}`];
      }, true);

      // noinspection SuspiciousTypeOfGuard
      if (typeof cmd === 'string') {
        args.cmd = cmd;
      } else if (typeof cmd === 'object') {
        args = cmd;
      } else {
        return reject(new Error('Invalid argument type.'));
      }

      const action = () => {
        // @ts-ignore
        window.__TAURI_IPC__({
          ...args,
          callback,
          error,
        });
      };

      action();
    });
  };

  function transformCallback(callback: any, once: boolean) {
    const identifier = uid();
    const prop = `_${identifier}`;

    Object.defineProperty(window, prop, {
      value: (result: any) => {
        if (once) {
          Reflect.deleteProperty(window, prop);
        }

        return callback && callback(result);
      },
      writable: false,
      configurable: true,
    });

    return identifier;
  }

  function postMessage(message: any) {
    const request = new XMLHttpRequest();
    request.addEventListener('load', function () {
      let arg;
      let success = this.status === 200;
      try {
        arg = JSON.parse(this.response);
      } catch (e) {
        arg = e;
        success = false;
      }
      // @ts-ignore
      window[`_${success ? message.callback : message.error}`](arg);
    });
    request.open('POST', 'http://localhost:8080/' + 'main', true);
    request.setRequestHeader('Content-Type', 'application/json');
    request.send(JSON.stringify(message));
  }

  function uid() {
    return window.crypto.getRandomValues(new Uint32Array(1))[0];
  }
}
