alter table email_provider_settings alter column primary_provider set default 'zeptomail';
update email_provider_settings set primary_provider = 'zeptomail' where id = true;
