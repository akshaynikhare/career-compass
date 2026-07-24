/**
 * strings.js — Single source of truth for JS-rendered UI strings (EN + HI).
 * Loaded synchronously BEFORE app.js / render.js / deepdive_app.js / i18n.js
 * on every page, so window.T() and window.pickLang() are available immediately
 * (no async race with rendering).
 *
 * Usage:
 *   window.getLang()            -> 'en' | 'hi'
 *   window.setLang('hi')        -> persists language
 *   window.T('key', a, b, ...)  -> localized string with {0},{1}... substituted
 *   window.pickLang(obj,'name') -> obj.name_hi (when hi + present) else obj.name
 *   window.tCat('Healthcare')   -> localized category label
 */
(function () {
  'use strict';

  var LANG_KEY = 'cat_lang';

  function getLang() {
    try { return localStorage.getItem(LANG_KEY) || 'en'; } catch (e) { return 'en'; }
  }
  function setLang(l) {
    try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  }

  function fmt(s, args) {
    return s.replace(/\{(\d+)\}/g, function (m, i) {
      return args[i] !== undefined ? args[i] : m;
    });
  }

  var STR = {
    en: {
      // ── Student info / test flow (app.js) ──
      si_err_name:       'Please enter your full name.',
      si_err_email:      'Please enter a valid email address.',
      si_err_phone:      'Please enter a valid 10-digit mobile number.',
      resume_from:       'Resume from Q{0} →',
      btn_next:          'Next →',
      btn_submit:        'Submit ✓',
      btn_calculating:   'Calculating…',
      btn_continue:      'Continue →',
      err_select_option: 'Please select an option to continue.',
      err_unanswered:    'Some questions are unanswered. Please go back and answer all questions.',
      err_calc:          'Something went wrong calculating your results. Please try again. ({0})',
      err_load:          'Failed to load data. Please refresh the page. ({0})',

      phase_personal:    'Personal Background',
      phase_quick:       'Quick Interests',
      phase_personality: 'Personality Profile',

      progress_q_of:        '{0} — Q{1} of {2}',
      section_complete_read:'Section complete — read and continue',

      interstitial_1: '<strong>Section 1 complete!</strong><br><br>Section 2 of 3: Career Interests<br><span style="font-size:0.875rem; color:var(--muted);">10 quick questions about what kind of work appeals to you. There are no right or wrong answers.</span>',
      interstitial_2: '<strong>Section 2 complete!</strong><br><br>Section 3 of 3: About Your Personality<br><span style="font-size:0.875rem; color:var(--muted);">25 short questions. Answer as you actually are — not how you think you should be.</span>',

      // ── Deep dive (deepdive_app.js) ──
      dd_finding: 'Finding your best match… Q{0}',

      // ── Deep dive result (result2.html) ──
      conf_pct:      '{0}% confidence',
      conf_runner:   '{0}% confidence — runner-up',
      winner_salary: '₹ {0}L–{1}L/yr',
      reason_prefer:  'You prefer "{0}" — this fits {1} more than {2}',
      reason_points:  'Your work preferences point more clearly towards {0} than {1}',
      reason_aligned: 'Your preferences consistently aligned with {0} throughout the test',

      // ── Results (render.js) ──
      profile_like_yours: 'A Profile Like Yours',
      why_matched:        'Why it matched',
      day_in_life:        'A day in the life',
      prep_resources:     'Free {0} prep resources',
      add_to_compare:     'Add to compare',
      show_n_more:        'Show {0} more',
      no_stretch:         'No stretch goals found — great fit!',
      no_matches:         'No matches found.',
      no_domain_matches:  'No domain matches found.',
      pct_match:          '{0}% match',
      meta_years:         '⏱ {0}+ yrs',
      meta_streams:       '📚 {0}',
      meta_exam:          '✍ {0}',
      meta_salary:        '₹ {0}–{1} LPA',
      compare_one_more:   '1 career selected — pick one more to compare',
      compare_vs:         '{0} vs {1}',
      constraints_prefix: '⚠️ Constraints: {0}',
      not_specified:      'Not specified',

      why_stream:    'Matches your {0} stream',
      why_years:     '{0}+ year path fits your {1}-year plan',
      why_exam:      '{0} exam intensity — matches your preference',
      why_personality: 'Aligns with your {0} personality ({1})',

      // Compare table row labels
      cmp_stream:    'Stream',
      cmp_duration:  'Study Duration',
      cmp_fee:       'Annual Fee',
      cmp_salary:    'Salary Range',
      cmp_exam:      'Entrance Exam',
      cmp_intensity: 'Exam Intensity',
      cmp_category:  'Category',
      cmp_years_val: '{0}+ years',

      intensity_low:      'Low',
      intensity_moderate: 'Moderate',
      intensity_high:     'High',
      intensity_low_dot:      '●○○ Low',
      intensity_moderate_dot: '●●○ Moderate',
      intensity_high_dot:     '●●● High',

      // RIASEC dimension labels
      dim_R: 'Realistic',
      dim_I: 'Investigative',
      dim_A: 'Artistic',
      dim_S: 'Social',
      dim_E: 'Enterprising',
      dim_C: 'Conventional',

      // ── Charts (charts.js callers: render.js / result2.html) ──
      chart_view_radar:   'Radar',
      chart_view_bars:    'Bars',
      chart_riasec_hint_radar: 'Each spoke shows your relative strength in that interest dimension.',
      chart_riasec_hint_bars:  'The bars show your relative strength in each interest dimension.',
      salary_outlook_title:   'Salary Outlook',
      salary_outlook_desc:    'Typical annual pay as you grow in your top career matches.',
      salary_stage_entry:     'Entry',
      salary_stage_mid:       'Mid',
      salary_stage_senior:    'Senior',
      salary_axis_label:      'Annual salary (₹ LPA)',
      salary_unit:            '₹',
      salary_suffix:          'L',
      domain_donut_center:    'fields',
      dd_confidence_title:    'How your matches compared',
      dd_confidence_desc:     'Confidence across your top career candidates after the deep dive.',

      // RIASEC "personality" descriptors (Why it matched)
      dimname_R: 'hands-on / technical',
      dimname_I: 'research / analytical',
      dimname_A: 'creative / expressive',
      dimname_S: 'people-focused',
      dimname_E: 'leadership / business',
      dimname_C: 'structured / detail-oriented',

      // Stream labels
      stream_pcm:      'Science (PCM)',
      stream_pcb:      'Science (PCB)',
      stream_commerce: 'Commerce',
      stream_arts:     'Arts / Humanities',
      stream_any:      'Any stream',
      stream_pcm_long: 'Science — PCM (Physics, Chemistry, Maths)',
      stream_pcb_long: 'Science — PCB (Physics, Chemistry, Biology)',

      // Constraint reason labels
      con_years_min:         'Study duration too long',
      con_annual_budget_inr: 'May exceed your budget',
      con_stream_pref:       'Stream mismatch',
      con_exam_intensity:    'Competitive exam required',

      // ── AI assistant (ai_ui.js) ──
      ai_thinking:       'Thinking…',
      ai_ask:            'Ask',
      ai_answer_fail:    'Sorry, I could not answer that right now. Please try again.',
      ai_roadmap_for:    'Roadmap to become a {0}',
      ai_roadmap_build:  'Building your roadmap…',
      ai_roadmap_fail:   'Roadmap unavailable right now. Please try again.',

      // ── Share card (share_card.js) ──
      card_brand:        'Career Compass',
      card_profile_you:  'Your Career Profile',
      card_profile_name: "{0}'s Career Profile",
      card_top_match:    'TOP MATCH',

      // Exam descriptions (tooltips)
      exam_NEET:         'National entrance for medical colleges',
      'exam_JEE Main':   'National entrance for engineering colleges',
      'exam_JEE Advanced':'Entrance for IITs (premium engineering)',
      exam_CLAT:         'National entrance for law colleges (NLUs)',
      exam_CAT:          'Entrance for IIMs and top MBA colleges',
      exam_GATE:         'Entrance for M.Tech and PSU jobs',
      exam_UPSC:         'Civil services — IAS, IPS, IFS'
    },

    hi: {
      // ── Student info / test flow (app.js) ──
      si_err_name:       'कृपया अपना पूरा नाम दर्ज करें।',
      si_err_email:      'कृपया एक मान्य ईमेल पता दर्ज करें।',
      si_err_phone:      'कृपया एक मान्य 10-अंकों का मोबाइल नंबर दर्ज करें।',
      resume_from:       'प्रश्न {0} से जारी रखें →',
      btn_next:          'आगे →',
      btn_submit:        'जमा करें ✓',
      btn_calculating:   'गणना हो रही है…',
      btn_continue:      'जारी रखें →',
      err_select_option: 'आगे बढ़ने के लिए कृपया एक विकल्प चुनें।',
      err_unanswered:    'कुछ प्रश्नों के उत्तर नहीं दिए गए हैं। कृपया पीछे जाकर सभी प्रश्नों के उत्तर दें।',
      err_calc:          'आपके परिणामों की गणना करते समय कुछ गड़बड़ हो गई। कृपया फिर से प्रयास करें। ({0})',
      err_load:          'डेटा लोड करने में विफल। कृपया पेज को रिफ्रेश करें। ({0})',

      phase_personal:    'व्यक्तिगत जानकारी',
      phase_quick:       'त्वरित रुचियाँ',
      phase_personality: 'व्यक्तित्व प्रोफाइल',

      progress_q_of:        '{0} — प्रश्न {1}/{2}',
      section_complete_read:'सेक्शन पूरा हुआ — पढ़ें और आगे बढ़ें',

      interstitial_1: '<strong>सेक्शन 1 पूरा हुआ!</strong><br><br>सेक्शन 2/3: करियर रुचियाँ<br><span style="font-size:0.875rem; color:var(--muted);">आपको किस तरह का काम पसंद है, इस बारे में 10 त्वरित प्रश्न। कोई उत्तर सही या गलत नहीं है।</span>',
      interstitial_2: '<strong>सेक्शन 2 पूरा हुआ!</strong><br><br>सेक्शन 3/3: आपके व्यक्तित्व के बारे में<br><span style="font-size:0.875rem; color:var(--muted);">25 छोटे प्रश्न। जैसे आप वास्तव में हैं वैसे उत्तर दें — जैसा आपको लगता है वैसा नहीं।</span>',

      // ── Deep dive (deepdive_app.js) ──
      dd_finding: 'आपका सबसे उपयुक्त करियर ढूंढ रहे हैं… प्रश्न {0}',

      // ── Deep dive result (result2.html) ──
      conf_pct:      '{0}% विश्वास',
      conf_runner:   '{0}% विश्वास — उपविजेता',
      winner_salary: '₹ {0}L–{1}L/वर्ष',
      reason_prefer:  'आप "{0}" पसंद करते हैं — यह {2} की तुलना में {1} के लिए अधिक उपयुक्त है',
      reason_points:  'आपकी कार्य पसंद {1} की तुलना में {0} की ओर अधिक स्पष्ट रूप से इशारा करती है',
      reason_aligned: 'पूरे टेस्ट के दौरान आपकी पसंद लगातार {0} से मेल खाती रही',

      // ── Results (render.js) ──
      profile_like_yours: 'आपके जैसा एक प्रोफाइल',
      why_matched:        'यह क्यों मेल खाता है',
      day_in_life:        'एक दिन की झलक',
      prep_resources:     'मुफ्त {0} तैयारी संसाधन',
      add_to_compare:     'तुलना में जोड़ें',
      show_n_more:        '{0} और दिखाएं',
      no_stretch:         'कोई महत्वाकांक्षी लक्ष्य नहीं मिला — बढ़िया मेल!',
      no_matches:         'कोई मिलान नहीं मिला।',
      no_domain_matches:  'कोई क्षेत्र मिलान नहीं मिला।',
      pct_match:          '{0}% मिलान',
      meta_years:         '⏱ {0}+ वर्ष',
      meta_streams:       '📚 {0}',
      meta_exam:          '✍ {0}',
      meta_salary:        '₹ {0}–{1} LPA',
      compare_one_more:   '1 करियर चुना गया — तुलना के लिए एक और चुनें',
      compare_vs:         '{0} बनाम {1}',
      constraints_prefix: '⚠️ बाधाएं: {0}',
      not_specified:      'निर्दिष्ट नहीं',

      why_stream:    'आपकी {0} स्ट्रीम से मेल खाता है',
      why_years:     '{0}+ वर्ष का रास्ता आपकी {1}-वर्ष की योजना में फिट बैठता है',
      why_exam:      '{0} परीक्षा तीव्रता — आपकी पसंद से मेल खाती है',
      why_personality: 'आपके {0} व्यक्तित्व ({1}) से मेल खाता है',

      // Compare table row labels
      cmp_stream:    'स्ट्रीम',
      cmp_duration:  'पढ़ाई की अवधि',
      cmp_fee:       'वार्षिक शुल्क',
      cmp_salary:    'वेतन सीमा',
      cmp_exam:      'प्रवेश परीक्षा',
      cmp_intensity: 'परीक्षा तीव्रता',
      cmp_category:  'श्रेणी',
      cmp_years_val: '{0}+ वर्ष',

      intensity_low:      'कम',
      intensity_moderate: 'मध्यम',
      intensity_high:     'अधिक',
      intensity_low_dot:      '●○○ कम',
      intensity_moderate_dot: '●●○ मध्यम',
      intensity_high_dot:     '●●● अधिक',

      // RIASEC dimension labels
      dim_R: 'यथार्थवादी (Realistic)',
      dim_I: 'खोजी (Investigative)',
      dim_A: 'कलात्मक (Artistic)',
      dim_S: 'सामाजिक (Social)',
      dim_E: 'उद्यमी (Enterprising)',
      dim_C: 'पारंपरिक (Conventional)',

      // ── Charts (charts.js callers: render.js / result2.html) ──
      chart_view_radar:   'रडार',
      chart_view_bars:    'बार',
      chart_riasec_hint_radar: 'हर भुजा उस रुचि आयाम में आपकी सापेक्ष क्षमता दिखाती है।',
      chart_riasec_hint_bars:  'ये बार प्रत्येक रुचि आयाम में आपकी सापेक्ष क्षमता दिखाते हैं।',
      salary_outlook_title:   'वेतन की संभावना',
      salary_outlook_desc:    'आपके शीर्ष करियर मिलानों में आगे बढ़ने पर सामान्य वार्षिक वेतन।',
      salary_stage_entry:     'शुरुआत',
      salary_stage_mid:       'मध्य',
      salary_stage_senior:    'वरिष्ठ',
      salary_axis_label:      'वार्षिक वेतन (₹ LPA)',
      salary_unit:            '₹',
      salary_suffix:          'L',
      domain_donut_center:    'क्षेत्र',
      dd_confidence_title:    'आपके मिलानों की तुलना कैसी रही',
      dd_confidence_desc:     'डीप डाइव के बाद आपके शीर्ष करियर उम्मीदवारों में विश्वास।',

      // RIASEC "personality" descriptors (Why it matched)
      dimname_R: 'व्यावहारिक / तकनीकी',
      dimname_I: 'अनुसंधान / विश्लेषणात्मक',
      dimname_A: 'रचनात्मक / अभिव्यंजक',
      dimname_S: 'लोगों पर केंद्रित',
      dimname_E: 'नेतृत्व / व्यवसाय',
      dimname_C: 'संगठित / विवरण-केंद्रित',

      // Stream labels
      stream_pcm:      'विज्ञान (PCM)',
      stream_pcb:      'विज्ञान (PCB)',
      stream_commerce: 'कॉमर्स',
      stream_arts:     'आर्ट्स / मानविकी',
      stream_any:      'कोई भी स्ट्रीम',
      stream_pcm_long: 'विज्ञान — PCM (भौतिकी, रसायन, गणित)',
      stream_pcb_long: 'विज्ञान — PCB (भौतिकी, रसायन, जीव विज्ञान)',

      // Constraint reason labels
      con_years_min:         'पढ़ाई की अवधि बहुत लंबी',
      con_annual_budget_inr: 'आपके बजट से अधिक हो सकता है',
      con_stream_pref:       'स्ट्रीम मेल नहीं खाती',
      con_exam_intensity:    'प्रतियोगी परीक्षा आवश्यक',

      // ── AI assistant (ai_ui.js) ──
      ai_thinking:       'सोच रहे हैं…',
      ai_ask:            'पूछें',
      ai_answer_fail:    'क्षमा करें, अभी इसका उत्तर नहीं दे सका। कृपया फिर से प्रयास करें।',
      ai_roadmap_for:    '{0} बनने का रोडमैप',
      ai_roadmap_build:  'आपका रोडमैप बना रहे हैं…',
      ai_roadmap_fail:   'रोडमैप अभी उपलब्ध नहीं है। कृपया फिर से प्रयास करें।',

      // ── Share card (share_card.js) ──
      card_brand:        'Career Compass',
      card_profile_you:  'आपका करियर प्रोफाइल',
      card_profile_name: '{0} का करियर प्रोफाइल',
      card_top_match:    'शीर्ष मिलान',

      // Exam descriptions (tooltips)
      exam_NEET:         'मेडिकल कॉलेजों के लिए राष्ट्रीय प्रवेश परीक्षा',
      'exam_JEE Main':   'इंजीनियरिंग कॉलेजों के लिए राष्ट्रीय प्रवेश परीक्षा',
      'exam_JEE Advanced':'IITs के लिए प्रवेश परीक्षा (प्रीमियम इंजीनियरिंग)',
      exam_CLAT:         'लॉ कॉलेजों (NLUs) के लिए राष्ट्रीय प्रवेश परीक्षा',
      exam_CAT:          'IIMs और शीर्ष MBA कॉलेजों के लिए प्रवेश परीक्षा',
      exam_GATE:         'M.Tech और PSU नौकरियों के लिए प्रवेश परीक्षा',
      exam_UPSC:         'सिविल सेवा — IAS, IPS, IFS'
    }
  };

  // Category labels (results badges + domain headers)
  var STR_CAT = {
    'Healthcare':                  'स्वास्थ्य सेवा',
    'Technology':                  'प्रौद्योगिकी',
    'Engineering':                 'इंजीनियरिंग',
    'Education':                   'शिक्षा',
    'Finance & Business':          'वित्त और व्यवसाय',
    'Finance — Specialized Niche': 'वित्त — विशेषज्ञ क्षेत्र',
    'Arts & Media':                'कला और मीडिया',
    'Law & Government':            'कानून और सरकार',
    'Science & Research':          'विज्ञान और अनुसंधान',
    'Social & Welfare':            'सामाजिक और कल्याण',
    'Mental Health & Wellness':    'मानसिक स्वास्थ्य और कल्याण',
    'Architecture & Design':       'वास्तुकला और डिज़ाइन',
    'Agriculture & Environment':   'कृषि और पर्यावरण',
    'Sports & Fitness':            'खेल और फिटनेस',
    'Hospitality & Food':          'आतिथ्य और खाद्य',
    'Transport & Logistics':       'परिवहन और लॉजिस्टिक्स',
    'Trades & Construction':       'ट्रेड्स और निर्माण',
    'Public Health & Policy':      'सार्वजनिक स्वास्थ्य और नीति',
    'Niche & Emerging Professions':'विशिष्ट और उभरते पेशे'
  };

  window.getLang = getLang;
  window.setLang = setLang;

  window.T = function (key) {
    var lang = getLang();
    var dict = STR[lang] || STR.en;
    var s = dict[key];
    if (s === undefined) s = STR.en[key];
    if (s === undefined) return key;
    var args = Array.prototype.slice.call(arguments, 1);
    return args.length ? fmt(s, args) : s;
  };

  // Pick a localized data field: obj.<field>_hi when Hindi and present, else obj.<field>
  window.pickLang = function (obj, field) {
    if (!obj) return '';
    if (getLang() === 'hi') {
      var hv = obj[field + '_hi'];
      if (hv !== undefined && hv !== null && hv !== '') return hv;
    }
    return obj[field];
  };

  window.tCat = function (cat) {
    if (getLang() === 'hi' && STR_CAT[cat]) return STR_CAT[cat];
    return cat;
  };

})();
