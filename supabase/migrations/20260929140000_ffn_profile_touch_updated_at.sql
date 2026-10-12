-- The About FFN profile never refreshed updated_at.
--
-- ffn_profile was created with an updated_at column but, unlike programs,
-- founders and the other content tables, no touch trigger. Every save left the
-- column at the value it got when the row was first inserted, so the "Last
-- updated" time on the About FFN page stayed frozen.
--
-- Same trigger and function as the other tables. Existing data is untouched;
-- the next save sets the real time.

drop trigger if exists ffn_profile_touch on ffn_profile;
create trigger ffn_profile_touch before update on ffn_profile
  for each row execute function touch_updated_at();
