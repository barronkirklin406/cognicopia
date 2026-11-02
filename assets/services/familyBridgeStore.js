/**
 * @file familyBridgeStore.js
 * @description Client-side browser service for Cognicopia Family Bridge.
 * Exposes window.CogniFamilyBridge for instant zero-dependency execution.
 */

(function (root) {
  'use strict';

  var STORAGE_TOKENS_KEY = 'cogni_family_tokens';
  var STORAGE_CONTRIBUTIONS_KEY = 'cogni_family_contributions';
  var STORAGE_RESIDENTS_KEY = 'cogni_residents';

  // Seed default roster if none in storage
  var DEFAULT_ROSTER = [
    {
      id: 'res_arthur_104',
      preferredName: 'Arthur Smith',
      nickname: 'Artie',
      unitNumber: '104',
      wing: 'Memory Care - West Wing',
      birthYear: 1934,
      age: 91,
      cognitiveTier: 2,
      motorCapabilityLevel: 'moderate',
      formativeEra: '1950s',
      corePassions: ['Woodworking', 'Steam Locomotives', 'Big Band Swing'],
      pastVocation: 'Railroad Machinist & Master Carpenter',
      onHandItems: ['colored pencils', 'tactile tokens', 'smooth sanding block'],
      hometown: { place: 'Williston, North Dakota', environment: 'small-town' }
    },
    {
      id: 'res_eleanor_112',
      preferredName: 'Eleanor Vance',
      nickname: 'Ellie',
      unitNumber: '112',
      wing: 'Memory Care - South Courtyard',
      birthYear: 1938,
      age: 87,
      cognitiveTier: 1,
      motorCapabilityLevel: 'high',
      formativeEra: '1960s',
      corePassions: ['Rose Gardening', 'Choral Singing', 'Country Kitchen'],
      pastVocation: 'Elementary School Teacher & Choir Director',
      onHandItems: ['colored pencils', 'memory stones'],
      hometown: { place: 'Appleton, Wisconsin', environment: 'small-town' }
    },
    {
      id: 'res_harold_205',
      preferredName: 'Harold Jenkins',
      nickname: 'Hal',
      unitNumber: '205',
      wing: 'Assisted Living - North Wing',
      birthYear: 1941,
      age: 84,
      cognitiveTier: 3,
      motorCapabilityLevel: 'assisted',
      formativeEra: '1960s',
      corePassions: ['Fishing', 'Ham Radio', 'Model Airplanes'],
      pastVocation: 'Electronics Technician & Navy Veteran',
      onHandItems: ['tactile tokens', 'thick felt markers'],
      hometown: { place: 'Duluth, Minnesota', environment: 'coastal' }
    },
    {
      id: 'res_clara_109',
      preferredName: 'Clara Higgins',
      nickname: 'Clare',
      unitNumber: '109',
      wing: 'Memory Care - West Wing',
      birthYear: 1932,
      age: 93,
      cognitiveTier: 2,
      motorCapabilityLevel: 'moderate',
      formativeEra: '1950s',
      corePassions: ['Baking Pies', 'Quilting', 'Church Hymns'],
      pastVocation: 'Bakery Owner & Homemaker',
      onHandItems: ['colored pencils', 'recipe tokens'],
      hometown: { place: 'Cedar Rapids, Iowa', environment: 'small-town' }
    }
  ];

  function getStorage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  }

  function base64UrlEncode(str) {
    try {
      var bytes = new TextEncoder().encode(str);
      var binary = '';
      for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) {
      return encodeURIComponent(str);
    }
  }

  function base64UrlDecode(str) {
    try {
      var base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      var binary = atob(base64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch (e) {
      return decodeURIComponent(str);
    }
  }

  function generateTokenId() {
    return 'bridge_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
  }

  var CogniFamilyBridge = {
    getDefaultRoster: function () {
      return DEFAULT_ROSTER;
    },

    getRoster: function () {
      var ls = getStorage();
      if (!ls) return DEFAULT_ROSTER;
      try {
        var raw = ls.getItem(STORAGE_RESIDENTS_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
      return DEFAULT_ROSTER;
    },

    saveRoster: function (roster) {
      var ls = getStorage();
      if (!ls) return;
      try {
        ls.setItem(STORAGE_RESIDENTS_KEY, JSON.stringify(roster));
      } catch (e) {}
    },

    createMagicLink: function (opts) {
      var tokenId = generateTokenId();
      var now = Date.now();
      var expiresAt = opts.expirationDays ? now + opts.expirationDays * 24 * 60 * 60 * 1000 : null;

      var payload = {
        token: tokenId,
        residentId: opts.residentId,
        residentName: opts.residentName,
        facilityName: opts.facilityName || 'St. Jude Memory Care',
        unitOrWing: opts.unitOrWing || 'Memory Care Wing',
        createdAt: now,
        expiresAt: expiresAt,
        customWelcomeNote: opts.customWelcomeNote || ''
      };

      var encoded = base64UrlEncode(JSON.stringify(payload));
      var origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : '';
      var path = (typeof window !== 'undefined' && window.location.pathname) ? window.location.pathname.replace(/\/[^\/]*$/, '/') : '/';
      var url = origin + path + 'family-bridge.html?token=' + tokenId + '&payload=' + encoded;

      var record = {
        token: tokenId,
        residentId: opts.residentId,
        residentName: opts.residentName,
        facilityName: payload.facilityName,
        createdAt: new Date(now).toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        status: 'active',
        submissionCount: 0,
        url: url
      };

      this.saveToken(record);
      return { token: tokenId, url: url, record: record, payload: payload };
    },

    parseUrl: function (urlOrSearch) {
      var search = urlOrSearch || (typeof window !== 'undefined' ? window.location.search : '');
      var params = new URLSearchParams(search.includes('?') ? search.split('?')[1] : search);
      var token = params.get('token');
      var payloadStr = params.get('payload');

      if (!token && !payloadStr) return null;

      var payload = null;
      if (payloadStr) {
        try {
          payload = JSON.parse(base64UrlDecode(payloadStr));
        } catch (e) {}
      }

      if (!payload && token) {
        var record = this.getToken(token);
        if (record) {
          payload = {
            token: record.token,
            residentId: record.residentId,
            residentName: record.residentName,
            facilityName: record.facilityName,
            createdAt: new Date(record.createdAt).getTime(),
            expiresAt: record.expiresAt ? new Date(record.expiresAt).getTime() : null
          };
        }
      }

      return payload;
    },

    generateSmsTemplate: function (residentName, facilityName, url) {
      return "Hi! From " + (facilityName || "our care team") + ": We're creating personalized memory activity books for " + residentName + ". Could you share a few favorite memories, recipes, and childhood places here? It takes just 3 minutes: " + url;
    },

    generateEmailTemplate: function (residentName, facilityName, url) {
      return {
        subject: "Help us personalize cognitive activities for " + residentName + " at " + facilityName,
        body: "Hello,\n\nAt " + facilityName + ", we are creating custom, dignified memory activity packets (word games, music memories, and reminiscence prompts) tailored specifically to " + residentName + "'s life story.\n\nWe would love your help! You can share cherished photos, recipes, and hometown memories through our secure Family Bridge:\n\n" + url + "\n\nIt takes only a few minutes and means the world to our team.\n\nWarm regards,\nThe Activities Team at " + facilityName
      };
    },

    getAllTokens: function () {
      var ls = getStorage();
      if (!ls) return [];
      try {
        var raw = ls.getItem(STORAGE_TOKENS_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    getToken: function (token) {
      var list = this.getAllTokens();
      for (var i = 0; i < list.length; i++) {
        if (list[i].token === token) return list[i];
      }
      return null;
    },

    saveToken: function (record) {
      var ls = getStorage();
      if (!ls) return;
      var list = this.getAllTokens();
      var found = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i].token === record.token) {
          list[i] = record;
          found = true;
          break;
        }
      }
      if (!found) list.unshift(record);
      try {
        ls.setItem(STORAGE_TOKENS_KEY, JSON.stringify(list));
      } catch (e) {}
    },

    getAllContributions: function () {
      var ls = getStorage();
      if (!ls) return [];
      try {
        var raw = ls.getItem(STORAGE_CONTRIBUTIONS_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    saveContribution: function (contrib) {
      var ls = getStorage();
      if (!ls) return;
      var list = this.getAllContributions();
      var found = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === contrib.id) {
          list[i] = contrib;
          found = true;
          break;
        }
      }
      if (!found) list.unshift(contrib);
      try {
        ls.setItem(STORAGE_CONTRIBUTIONS_KEY, JSON.stringify(list));
      } catch (e) {}

      // Update token submission status
      var tokenRecord = this.getToken(contrib.token);
      if (tokenRecord) {
        tokenRecord.submissionCount = (tokenRecord.submissionCount || 0) + 1;
        tokenRecord.status = 'submitted';
        this.saveToken(tokenRecord);
      }
    },

    mergeContributionIntoResident: function (resident, contrib) {
      if (!resident || !contrib) return;
      resident.corePassions = resident.corePassions || [];

      if (contrib.recipes && contrib.recipes.length > 0) {
        contrib.recipes.forEach(function (r) {
          if (r.recipeName && resident.corePassions.indexOf(r.recipeName) === -1) {
            resident.corePassions.push(r.recipeName);
          }
        });
      }

      if (contrib.landmarks && contrib.landmarks.length > 0) {
        contrib.landmarks.forEach(function (lm) {
          if (lm.landmarkName && resident.corePassions.indexOf(lm.landmarkName) === -1) {
            resident.corePassions.push(lm.landmarkName);
          }
        });
      }

      if (contrib.career && contrib.career.favoriteTools) {
        contrib.career.favoriteTools.forEach(function (t) {
          if (t && resident.corePassions.indexOf(t) === -1) {
            resident.corePassions.push(t);
          }
        });
      }

      var roster = this.getRoster();
      for (var i = 0; i < roster.length; i++) {
        if (roster[i].id === resident.id) {
          roster[i] = resident;
          break;
        }
      }
      this.saveRoster(roster);
      return resident;
    }
  };

  root.CogniFamilyBridge = CogniFamilyBridge;
})(typeof self !== 'undefined' ? self : this);
