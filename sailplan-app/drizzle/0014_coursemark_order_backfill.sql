-- Backfill `courseMark.order` from row id, per course.
--
-- `createCourseMark` used a falsy check on the existing max order, so once a
-- course's first mark took order 0 every later mark took 0 too: every course
-- built through the UI has a zeroed sequence, and its mark order fell out of
-- SQLite's arbitrary tiebreak. Course-anchored leg detection reads that
-- sequence as the order the marks were sailed, so it has to be real.
--
-- Row id is insertion order, which is the order the sailor entered the marks.
-- Only courses whose orders are not already distinct are rewritten, so a course
-- with a deliberate sequence is left exactly as it is.
UPDATE `courseMark`
SET `order` = (
  SELECT COUNT(*)
  FROM `courseMark` AS earlier
  WHERE earlier.`courseId` = `courseMark`.`courseId`
    AND earlier.`id` < `courseMark`.`id`
)
WHERE `courseId` IN (
  SELECT `courseId`
  FROM `courseMark`
  GROUP BY `courseId`
  HAVING COUNT(*) > COUNT(DISTINCT `order`)
);
