(() => {
  'use strict';
  let connection;
  window.BDSAcademyClient = () => {
    connection ??= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({ createClient }) => {
      const { supabaseUrl, supabasePublishableKey } = window.BDS_ACADEMY_CONFIG;
      return createClient(supabaseUrl, supabasePublishableKey, { auth: { flowType: 'pkce' } });
    });
    return connection;
  };
})();
