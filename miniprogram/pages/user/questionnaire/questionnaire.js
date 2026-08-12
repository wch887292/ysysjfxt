// pages/user/questionnaire/questionnaire.js
const { questionnaireAPI } = require('../../../utils/api');

Page({
  data: {
    currentStep: 0,
    totalSteps: 5,
    answers: {},
    consentAccepted: false,
    hasResult: false,
    questionnaire: [
      {
        id: 'basic_info',
        title: '基础信息',
        questions: [
          {
            id: 'age',
            label: '您的年龄',
            type: 'number',
            placeholder: '请输入年龄',
            required: true
          },
          {
            id: 'gender',
            label: '您的性别',
            type: 'picker',
            options: ['男', '女'],
            required: true
          },
          {
            id: 'height',
            label: '身高(cm)',
            type: 'number',
            placeholder: '请输入身高',
            required: true
          },
          {
            id: 'weight',
            label: '体重(kg)',
            type: 'number',
            placeholder: '请输入体重',
            required: true
          }
        ]
      },
      {
        id: 'health_conditions',
        title: '健康状况',
        questions: [
          {
            id: 'chronic_diseases',
            label: '是否有慢性疾病',
            type: 'checkbox',
            options: ['高血压', '糖尿病', '高血脂', '心脏病', '痛风', '无'],
            required: true
          },
          {
            id: 'allergies',
            label: '是否有食物过敏',
            type: 'checkbox',
            options: ['海鲜', '坚果', '蛋类', '奶制品', '无'],
            required: true
          }
        ]
      },
      {
        id: 'eating_habits',
        title: '饮食习惯',
        questions: [
          {
            id: 'meals_per_day',
            label: '每日用餐次数',
            type: 'picker',
            options: ['2餐', '3餐', '4餐', '5餐及以上'],
            required: true
          },
          {
            id: 'breakfast_habit',
            label: '早餐习惯',
            type: 'picker',
            options: ['每天都吃', '偶尔吃', '很少吃', '从不吃'],
            required: true
          },
          {
            id: 'vegetable_intake',
            label: '蔬菜摄入量',
            type: 'picker',
            options: ['很少', '适量', '充足', '很多'],
            required: true
          }
        ]
      },
      {
        id: 'lifestyle',
        title: '生活方式',
        questions: [
          {
            id: 'exercise_frequency',
            label: '运动频率',
            type: 'picker',
            options: ['从不', '偶尔', '每周1-2次', '每周3-4次', '每天'],
            required: true
          },
          {
            id: 'sleep_quality',
            label: '睡眠质量',
            type: 'picker',
            options: ['很差', '较差', '一般', '良好', '很好'],
            required: true
          }
        ]
      },
      {
        id: 'health_goals',
        title: '健康目标',
        questions: [
          {
            id: 'goals',
            label: '您的健康目标(可多选)',
            type: 'checkbox',
            options: ['减重', '增肌', '改善睡眠', '改善消化', '增强免疫力', '改善慢性病', '保持健康'],
            required: true
          }
        ]
      }
    ],
    declaration: '【数据收集告知】\n本问卷将收集您的年龄、性别、身高、体重、健康状况、饮食习惯、生活方式和健康目标等信息，用于：\n1. 为您生成个性化的健康评估与饮食建议\n2. 匿名化统计分析，改进产品服务质量\n3. 发送健康提醒与积分奖励\n\n您的信息将被严格保密，不会用于任何商业营销目的，也不会与第三方共享。\n本问卷信息仅用于制定个性化饮食与生活方式建议，不构成任何医疗诊断、治疗或处方。所有健康决策请咨询专业医师。',
  },

  onLoad() {
    // 恢复草稿
    const draft = wx.getStorageSync('questionnaire_draft');
    if (draft && typeof draft === 'object') {
      this.setData({ answers: draft });
    }
    // 检查是否已有评估结果,用于显示"查看上次评估结果"入口
    // silent=true：未完成问卷时不弹错误提示
    questionnaireAPI.getResult(true).then(res => {
      if (res && res.success) {
        this.setData({ hasResult: true });
      }
    }).catch(() => {
      // 无结果或请求失败时忽略,不影响填写流程
    });
  },

  onInputChange(e) {
    const { questionId } = e.currentTarget.dataset;
    const value = e.detail.value;
    const answers = Object.assign({}, this.data.answers);
    answers[questionId] = value;
    this.setData({ answers });
    this.saveDraft();
  },

  onPickerChange(e) {
    const { questionId } = e.currentTarget.dataset;
    const index = e.detail.value;
    // 查找对应问题的选项列表
    let options = [];
    for (const step of this.data.questionnaire) {
      const q = step.questions.find(q => q.id === questionId);
      if (q) { options = q.options; break; }
    }
    const value = options[index] || index;
    const answers = Object.assign({}, this.data.answers);
    answers[questionId] = value;
    this.setData({ answers });
    this.saveDraft();
  },

  onCheckboxChange(e) {
    const { questionId } = e.currentTarget.dataset;
    const values = e.detail.value;
    const answers = Object.assign({}, this.data.answers);
    answers[questionId] = values;
    this.setData({ answers });
    this.saveDraft();
  },

  nextStep() {
    // 校验当前步骤的必填项
    const currentStepData = this.data.questionnaire[this.data.currentStep];
    if (currentStepData && currentStepData.questions) {
      const answers = this.data.answers;
      for (const q of currentStepData.questions) {
        if (!q.required) continue;
        const val = answers[q.id];
        let valid = false;
        if (q.type === 'number') {
          valid = val !== undefined && val !== null && val !== '' && !isNaN(Number(val));
        } else if (q.type === 'picker') {
          valid = val !== undefined && val !== null && val !== '';
        } else if (q.type === 'checkbox') {
          valid = Array.isArray(val) && val.length > 0;
        }
        if (!valid) {
          wx.showToast({
            title: '请完成所有必填项',
            icon: 'none'
          });
          return;
        }
      }
    }

    if (this.data.currentStep < this.data.totalSteps - 1) {
      this.setData({
        currentStep: this.data.currentStep + 1
      });
    } else {
      // 规格12.1：提交前校验隐私授权同意
      if (!this.data.consentAccepted) {
        wx.showToast({
          title: '请先勾选同意《隐私政策与免责声明》',
          icon: 'none',
          duration: 3000
        });
        return;
      }
      this.submitQuestionnaire();
    }
  },

  // 规格12.1：隐私授权同意勾选
  // P1 修复：checkbox-group bindchange 的 e.detail.value 是数组，需取 length
  toggleConsent(e) {
    this.setData({ consentAccepted: e.detail.value && e.detail.value.length > 0 });
  },

  // 跳转隐私政策页
  viewPrivacy() {
    wx.navigateTo({ url: '/pages/user/privacy/privacy' });
  },

  prevStep() {
    if (this.data.currentStep > 0) {
      this.setData({
        currentStep: this.data.currentStep - 1
      });
    }
  },

  // 保存草稿到本地存储,供中断后恢复
  saveDraft() {
    wx.setStorageSync('questionnaire_draft', this.data.answers);
  },

  // 点击"查看上次评估结果"卡片,跳转危机钩子报告页
  viewResult() {
    wx.redirectTo({ url: '/pages/user/report/crisis-hook' });
  },

  submitQuestionnaire() {
    wx.showLoading({ title: '提交中...' });

    questionnaireAPI.submit({
      answers: this.data.answers,
      completedAt: new Date().toISOString(),
      consent_accepted: this.data.consentAccepted
    }).then(res => {
      if (res.success !== false) {
        // 提交成功后清除本地草稿
        wx.removeStorageSync('questionnaire_draft');
        wx.showModal({
          title: '提交成功',
          content: '感谢您的填写!现在为您生成危机钩子报告。',
          showCancel: false,
          success: () => {
            wx.redirectTo({ url: '/pages/user/report/crisis-hook' });
          }
        });
      } else {
        wx.showToast({
          title: res.message || '提交失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('提交失败', err);
      wx.showToast({
        title: '提交失败,请重试',
        icon: 'none'
      });
    }).finally(() => {
      wx.hideLoading();
    });
  }
});