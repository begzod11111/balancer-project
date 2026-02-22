// packages/crm/src/components/IssueCard/IssueCard.jsx
import React from 'react';
import { FaExternalLinkAlt, FaTicketAlt } from 'react-icons/fa';
import classes from './IssueCard.module.css';

const IssueCard = ({
  issue,
  departmentName,
  typeName,
  statusName,
  statusClass,
  assigneeName
}) => {
  const jiraUrl = `https://your-jira-domain.atlassian.net/browse/${issue.issueKey}`;

  return (
    <a
      href={jiraUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={classes.card}
    >
      <div className={classes.cardHeader}>
        <div className={classes.issueKey}>
          <FaTicketAlt />
          {issue.issueKey}
        </div>
        <div className={classes.type}>{typeName}</div>
        <FaExternalLinkAlt className={classes.externalIcon} />
      </div>

      <div className={classes.cardBody}>
        <div className={classes.infoRow}>
          <span className={classes.icon}>🏢</span>
          <span className={classes.label}>Отдел:</span>
          <strong>{departmentName}</strong>
        </div>

        <div className={classes.infoRow}>
          <span className={classes.icon}>👤</span>
          <span className={classes.label}>Исполнитель:</span>
          <strong>{assigneeName}</strong>
        </div>

        <div className={classes.infoRow}>
          <span className={classes.icon}>📊</span>
          <span className={classes.label}>Статус:</span>
          <span className={`${classes.statusBadge} ${classes[statusClass]}`}>
            {statusName}
          </span>
        </div>

        <div className={classes.infoRow}>
          <span className={classes.icon}>📅</span>
          <span className={classes.label}>Создана:</span>
          <strong>{new Date(issue.createdAt).toLocaleString('ru-RU')}</strong>
        </div>

        <div className={classes.infoRow}>
          <span className={classes.icon}>🔄</span>
          <span className={classes.label}>Обновлена:</span>
          <strong>{new Date(issue.updatedAt).toLocaleString('ru-RU')}</strong>
        </div>
      </div>
    </a>
  );
};

export default IssueCard;
