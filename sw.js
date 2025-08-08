const CACHE_NAME = 'sudoku-master-v1.0.0';
const STATIC_CACHE_NAME = 'sudoku-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'sudoku-dynamic-v1.0.0';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/sudoku-generator.js',
  '/js/game-logic.js',
  '/js/ui-manager.js',
  '/js/data-manager.js',
  '/js/main.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// 需要在线优先的资源
const ONLINE_FIRST = [];

// 缓存优先的资源
const CACHE_FIRST = [
  '/styles.css',
  '/js/',
  '/icon-'
];

// Service Worker 安装事件
self.addEventListener('install', event => {
  console.log('Service Worker 正在安装...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('正在缓存静态资源...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('静态资源缓存完成');
        return self.skipWaiting(); // 立即激活新的 Service Worker
      })
      .catch(error => {
        console.error('缓存静态资源失败:', error);
      })
  );
});

// Service Worker 激活事件
self.addEventListener('activate', event => {
  console.log('Service Worker 正在激活...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // 删除旧版本的缓存
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName.startsWith('sudoku-')) {
              console.log('删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker 激活完成');
        return self.clients.claim(); // 立即控制所有客户端
      })
  );
});

// 网络请求拦截
self.addEventListener('fetch', event => {
  const requestURL = new URL(event.request.url);
  
  // 只处理同源请求
  if (requestURL.origin !== location.origin) {
    return;
  }

  // 根据资源类型选择缓存策略
  if (shouldCacheFirst(event.request.url)) {
    event.respondWith(cacheFirst(event.request));
  } else if (shouldOnlineFirst(event.request.url)) {
    event.respondWith(onlineFirst(event.request));
  } else {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

// 判断是否应该缓存优先
function shouldCacheFirst(url) {
  return CACHE_FIRST.some(pattern => url.includes(pattern));
}

// 判断是否应该在线优先
function shouldOnlineFirst(url) {
  return ONLINE_FIRST.some(pattern => url.includes(pattern));
}

// 缓存优先策略
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
    
  } catch (error) {
    console.error('缓存优先策略失败:', error);
    return new Response('离线状态下无法访问此资源', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// 在线优先策略
async function onlineFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
    
  } catch (error) {
    console.log('网络请求失败，尝试从缓存获取:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('网络连接失败且无缓存', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Stale While Revalidate 策略
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // 异步更新缓存
  const networkResponsePromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(error => {
      console.log('网络更新失败:', error);
      return null;
    });

  // 如果有缓存，立即返回缓存内容
  if (cachedResponse) {
    return cachedResponse;
  }

  // 如果没有缓存，等待网络响应
  try {
    const networkResponse = await networkResponsePromise;
    if (networkResponse) {
      return networkResponse;
    }
  } catch (error) {
    console.error('网络请求完全失败:', error);
  }

  // 返回离线页面
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>离线状态</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 50px;
                background: #f5f5f5;
            }
            .offline-container {
                max-width: 400px;
                margin: 0 auto;
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .offline-icon {
                font-size: 4em;
                margin-bottom: 20px;
            }
            .offline-title {
                color: #333;
                margin-bottom: 15px;
            }
            .offline-message {
                color: #666;
                margin-bottom: 30px;
            }
            .retry-button {
                background: #2196F3;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
            }
            .retry-button:hover {
                background: #1976D2;
            }
        </style>
    </head>
    <body>
        <div class="offline-container">
            <div class="offline-icon">📱</div>
            <h2 class="offline-title">当前处于离线状态</h2>
            <p class="offline-message">请检查网络连接后重试</p>
            <button class="retry-button" onclick="window.location.reload()">重新加载</button>
        </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// 消息处理
self.addEventListener('message', event => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
      
    case 'UPDATE_CACHE':
      updateCache(data.urls).then(() => {
        event.ports[0].postMessage({ type: 'CACHE_UPDATED' });
      });
      break;
  }
});

// 获取缓存大小
async function getCacheSize() {
  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (let cacheName of cacheNames) {
      if (cacheName.startsWith('sudoku-')) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        for (let request of keys) {
          const response = await cache.match(request);
          if (response) {
            const size = await getResponseSize(response);
            totalSize += size;
          }
        }
      }
    }

    return totalSize;
  } catch (error) {
    console.error('获取缓存大小失败:', error);
    return 0;
  }
}

// 获取响应大小
async function getResponseSize(response) {
  try {
    const blob = await response.blob();
    return blob.size;
  } catch (error) {
    return 0;
  }
}

// 清除所有缓存
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames
      .filter(name => name.startsWith('sudoku-'))
      .map(name => caches.delete(name));
    
    await Promise.all(deletePromises);
    console.log('所有缓存已清除');
  } catch (error) {
    console.error('清除缓存失败:', error);
  }
}

// 更新缓存
async function updateCache(urls) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    await cache.addAll(urls || STATIC_ASSETS);
    console.log('缓存更新完成');
  } catch (error) {
    console.error('更新缓存失败:', error);
  }
}

// 后台同步
self.addEventListener('sync', event => {
  console.log('后台同步事件:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// 执行后台同步
async function doBackgroundSync() {
  try {
    // 这里可以执行一些后台任务
    // 比如同步游戏数据、更新缓存等
    console.log('执行后台同步任务');
    
    // 向客户端发送同步完成消息
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: new Date().toISOString()
      });
    });
    
  } catch (error) {
    console.error('后台同步失败:', error);
  }
}

// 推送通知
self.addEventListener('push', event => {
  console.log('收到推送:', event);
  
  const options = {
    body: event.data ? event.data.text() : '新的数独挑战等待您！',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: '立即挑战',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: '稍后再说',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('数独大师', options)
  );
});

// 通知点击处理
self.addEventListener('notificationclick', event => {
  console.log('通知点击:', event);
  
  event.notification.close();

  if (event.action === 'explore') {
    // 打开应用并导航到游戏页面
    event.waitUntil(
      clients.openWindow('/?action=continue')
    );
  } else if (event.action === 'close') {
    // 关闭通知，不做其他操作
    console.log('用户选择稍后再说');
  } else {
    // 默认行为：打开应用
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('Service Worker 脚本已加载');