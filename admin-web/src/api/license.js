// 授权许可证管理 API
import request from './request'

// 获取授权状态
export function getLicenseStatus() {
  return request({
    url: '/license/status',
    method: 'get'
  })
}

// 激活许可证
export function activateLicense(licenseKey) {
  return request({
    url: '/license/activate',
    method: 'post',
    data: { licenseKey }
  })
}
