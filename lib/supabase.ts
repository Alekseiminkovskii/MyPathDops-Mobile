import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const SUPABASE_URL = "https://wnmnfhjugrnzelkrqitz.supabase.co";
const SUPABASE_KEY = "sb_publishable_ccNqnvDbNhpVL_29g5kjFQ__Jqbynhn";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
