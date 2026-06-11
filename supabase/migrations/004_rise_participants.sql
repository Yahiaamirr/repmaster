-- ══════════════════════════════════════════════════════════
--  RISE Opening Event — individual-event participants
--  Generated from the registration CSV. Re-runnable (clears the
--  4 individual-event rosters first; RISE Battle Cycles untouched).
-- ══════════════════════════════════════════════════════════

delete from rise_competitors
 where event_id in (
   select id from rise_events
    where slug in ('lftd-hyrox','evolve-deadlift-ladder','rlntlss-box-jumps','turbo-deadhang')
 );

-- lftd-hyrox (50)
insert into rise_competitors (event_id, name, gender, display_order)
select e.id, v.name, v.gender::rise_gender, v.ord
from rise_events e join (values
  ('Abdelrahman mohamed mostafa kamel Darwisj','M',1),
  ('Adam elshaer','M',2),
  ('Ahmed elgohary','M',3),
  ('Ahmed reda','M',4),
  ('Ahmed refaat','M',5),
  ('Ahmed Wael','M',6),
  ('ali ehab','M',7),
  ('Badr khaldeen','M',8),
  ('badr wakid','M',9),
  ('Dima Hatem El Toudy','F',10),
  ('farouk osama','M',11),
  ('Hassan Hatem','M',12),
  ('Hossam Eissa','M',13),
  ('Ibrahim ahmed hosni','M',14),
  ('Jamela Anwar','F',15),
  ('Janna yasser','F',16),
  ('Jannah Karim ElSokkary','F',17),
  ('Karim Ali Mostafa','M',18),
  ('Kenzy ahmed','F',19),
  ('Kotb mahmoud','M',20),
  ('Malak amr abdelaziz mostfa abdo Zatoun','F',21),
  ('Mariam khalifa','F',22),
  ('Menna Dafrawy','F',23),
  ('Mohamed hany abozeid','M',24),
  ('Mohamed Hazem Mahgoub','M',25),
  ('Mohamed hussein','M',26),
  ('Mohamed Ihab El Shaboury','M',27),
  ('Mohamed mostafa abdelbaset','M',28),
  ('Mohamed Said Bendary Shih','M',29),
  ('Mostafa mohamed','M',30),
  ('Muaaz Helal','M',31),
  ('nour mohamed','F',32),
  ('Omar elshaer','M',33),
  ('Omar eñgarhy','M',34),
  ('Omar Fouad','M',35),
  ('Omar Mohamed','M',36),
  ('Omar Sherif','M',37),
  ('Radwan Ali Radwan','M',38),
  ('Rawan nasser hussien','F',39),
  ('Roaa saqr','F',40),
  ('Seif Abdelrehim','M',41),
  ('Seif yasser fouad','M',42),
  ('Shady Ashraf','M',43),
  ('Tia Youssef Anwar','F',44),
  ('yahia amr','M',45),
  ('Yahia Hafez','M',46),
  ('Yassin Ahmed','M',47),
  ('Yassin Nader','M',48),
  ('Youssef ashraf fam','M',49),
  ('Zein ELSHAER','M',50)
) as v(name,gender,ord) on e.slug = 'lftd-hyrox';

-- evolve-deadlift-ladder (33)
insert into rise_competitors (event_id, name, gender, display_order)
select e.id, v.name, v.gender::rise_gender, v.ord
from rise_events e join (values
  ('Abdelrahman mohamed mostafa kamel Darwisj','M',1),
  ('Adam elshaer','M',2),
  ('Ahmad elshaer','M',3),
  ('Ahmed reda','M',4),
  ('Ahmed refaat','M',5),
  ('Hassan Hatem','M',6),
  ('Hossam Eissa','M',7),
  ('Ibrahim ahmed hosni','M',8),
  ('Janna yasser','F',9),
  ('Jannah Karim ElSokkary','F',10),
  ('Kenzy ahmed','F',11),
  ('Kotb mahmoud','M',12),
  ('Malak amr abdelaziz mostfa abdo Zatoun','F',13),
  ('Menna Dafrawy','F',14),
  ('Mohamed hany abozeid','M',15),
  ('Muaaz Helal','M',16),
  ('muhammed amr muhammed','M',17),
  ('Nasrbibers','M',18),
  ('Omar elshaer','M',19),
  ('Omar Maged Shaker','M',20),
  ('Omar Mohamed','M',21),
  ('Omar Mohamed Shehata','M',22),
  ('Omar Sherif','M',23),
  ('Radwan Ali Radwan','M',24),
  ('Rawan nasser hussien','F',25),
  ('Roaa saqr','F',26),
  ('Seif Abdelrehim','M',27),
  ('Shady Ashraf','M',28),
  ('Tia Youssef Anwar','F',29),
  ('Yassin Ahmed','M',30),
  ('Yassin Nader','M',31),
  ('Youssef ashraf fam','M',32),
  ('Zein ELSHAER','M',33)
) as v(name,gender,ord) on e.slug = 'evolve-deadlift-ladder';

-- rlntlss-box-jumps (45)
insert into rise_competitors (event_id, name, gender, display_order)
select e.id, v.name, v.gender::rise_gender, v.ord
from rise_events e join (values
  ('Abdelrahman mohamed mostafa kamel Darwisj','M',1),
  ('Adam elshaer','M',2),
  ('Ahmad elshaer','M',3),
  ('Ahmed elgohary','M',4),
  ('Ahmed reda','M',5),
  ('Ahmed refaat','M',6),
  ('Ali Hussein','M',7),
  ('Badr khaldeen','M',8),
  ('farouk osama','M',9),
  ('Hassan Hatem','M',10),
  ('Hazem Mohtady','M',11),
  ('Hossam Eissa','M',12),
  ('Ibrahim ahmed hosni','M',13),
  ('Janna yasser','F',14),
  ('Jannah Karim ElSokkary','F',15),
  ('karim yacout','M',16),
  ('Kenzy ahmed','F',17),
  ('Kotb mahmoud','M',18),
  ('Malak amr abdelaziz mostfa abdo Zatoun','F',19),
  ('Menna Dafrawy','F',20),
  ('Mohamed hany abozeid','M',21),
  ('Mohamed Hazem Mahgoub','M',22),
  ('Mohamed hussein','M',23),
  ('Mohamed Ihab El Shaboury','M',24),
  ('Mohamed mostafa abdelbaset','M',25),
  ('Muaaz Helal','M',26),
  ('Nasrbibers','M',27),
  ('Omar ayman sheboo','M',28),
  ('Omar elshaer','M',29),
  ('Omar Mohamed','M',30),
  ('Omar Sherif','M',31),
  ('Osama Tarek','M',32),
  ('Radwan Ali Radwan','M',33),
  ('Rawan nasser hussien','F',34),
  ('Roaa saqr','F',35),
  ('Seif Abdelrehim','M',36),
  ('Seif yasser fouad','M',37),
  ('Shady Ashraf','M',38),
  ('Tia Youssef Anwar','F',39),
  ('yahia amr','M',40),
  ('Yahia Hafez','M',41),
  ('Yassin Ahmed','M',42),
  ('Yassin Nader','M',43),
  ('Youssef ashraf fam','M',44),
  ('Zein ELSHAER','M',45)
) as v(name,gender,ord) on e.slug = 'rlntlss-box-jumps';

-- turbo-deadhang (27)
insert into rise_competitors (event_id, name, gender, display_order)
select e.id, v.name, v.gender::rise_gender, v.ord
from rise_events e join (values
  ('Abdelrahman mohamed mostafa kamel Darwisj','M',1),
  ('Adam elshaer','M',2),
  ('Ahmed reda','M',3),
  ('Ahmed refaat','M',4),
  ('Hassan Hatem','M',5),
  ('Hossam Eissa','M',6),
  ('Ibrahim ahmed hosni','M',7),
  ('Janna yasser','F',8),
  ('Jannah Karim ElSokkary','F',9),
  ('Kenzy ahmed','F',10),
  ('Kotb mahmoud','M',11),
  ('Malak amr abdelaziz mostfa abdo Zatoun','F',12),
  ('Menna Dafrawy','F',13),
  ('Muaaz Helal','M',14),
  ('Omar elshaer','M',15),
  ('Omar Mohamed','M',16),
  ('Omar Sherif','M',17),
  ('Radwan Ali Radwan','M',18),
  ('Rawan nasser hussien','F',19),
  ('Roaa saqr','F',20),
  ('Seif Abdelrehim','M',21),
  ('Shady Ashraf','M',22),
  ('Tia Youssef Anwar','F',23),
  ('Yassin Ahmed','M',24),
  ('Yassin Nader','M',25),
  ('Youssef ashraf fam','M',26),
  ('Zein ELSHAER','M',27)
) as v(name,gender,ord) on e.slug = 'turbo-deadhang';

