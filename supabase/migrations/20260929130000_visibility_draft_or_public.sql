-- Content visibility is draft or public. "hidden" is removed.
--
-- Hidden and draft did the same thing: hub-hydrate only reads rows where
-- visibility = 'public', so neither ever reached a hub. Keeping both only gave
-- staff a choice with no difference behind it.
--
-- Any row still marked hidden becomes a draft first, which is what it already
-- behaved as, so nothing changes for a visitor. Then the check constraint on
-- each table stops allowing 'hidden'. Adding the new constraint validates every
-- existing row, so if a hidden row slipped in between the update and the
-- constraint, the whole migration rolls back instead of leaving a bad state.

update founders     set visibility = 'draft' where visibility = 'hidden';
update case_studies set visibility = 'draft' where visibility = 'hidden';
update testimonials set visibility = 'draft' where visibility = 'hidden';
update mentors      set visibility = 'draft' where visibility = 'hidden';
update faqs         set visibility = 'draft' where visibility = 'hidden';
update programs     set visibility = 'draft' where visibility = 'hidden';

alter table founders     drop constraint if exists founders_visibility_check,
                         add  constraint founders_visibility_check     check (visibility in ('draft', 'public'));
alter table case_studies drop constraint if exists case_studies_visibility_check,
                         add  constraint case_studies_visibility_check check (visibility in ('draft', 'public'));
alter table testimonials drop constraint if exists testimonials_visibility_check,
                         add  constraint testimonials_visibility_check check (visibility in ('draft', 'public'));
alter table mentors      drop constraint if exists mentors_visibility_check,
                         add  constraint mentors_visibility_check      check (visibility in ('draft', 'public'));
alter table faqs         drop constraint if exists faqs_visibility_check,
                         add  constraint faqs_visibility_check         check (visibility in ('draft', 'public'));
alter table programs     drop constraint if exists programs_visibility_check,
                         add  constraint programs_visibility_check     check (visibility in ('draft', 'public'));
