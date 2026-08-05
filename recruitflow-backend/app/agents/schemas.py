"""Pydantic schemas shared across agents.

``ParsedResume`` is the structured contract the Resume Parser Agent must fill
via its ``save_parsed_candidate()`` tool. Using a Pydantic model as the tool
parameter type means the Agents SDK generates a JSON schema for the tool and
validates the model's arguments before our code ever runs — the "Pydantic-
schema-checked output" the Module 4 spec calls for.

Every field is optional (or list-with-default) on purpose: real resumes are
messy and a missing phone number should degrade one field, not fail the whole
extraction. The agent is instructed to omit what it can't find rather than
hallucinate, and to call ``flag_low_confidence_extraction()`` when the resume
is too sparse/garbled to trust.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class Education(BaseModel):
    """A single education entry."""

    institution: Optional[str] = Field(
        default=None, description="School / university / college name"
    )
    degree: Optional[str] = Field(
        default=None, description="Degree or qualification, e.g. 'BSc Computer Science'"
    )
    field_of_study: Optional[str] = Field(default=None, description="Major / specialization")
    start_year: Optional[str] = Field(default=None, description="Start year if stated")
    end_year: Optional[str] = Field(
        default=None, description="Graduation / end year, or 'Present' if ongoing"
    )


class Employment(BaseModel):
    """A single past or current employer / role."""

    company: Optional[str] = Field(default=None, description="Employer name")
    title: Optional[str] = Field(default=None, description="Job title held")
    start_date: Optional[str] = Field(default=None, description="Start date as written")
    end_date: Optional[str] = Field(
        default=None, description="End date as written, or 'Present' if current"
    )
    description: Optional[str] = Field(
        default=None, description="Short summary of responsibilities if available"
    )


class ParsedResume(BaseModel):
    """Structured data extracted from a resume by the Resume Parser Agent."""

    full_name: Optional[str] = Field(default=None, description="Candidate's full name")
    email: Optional[str] = Field(default=None, description="Primary email address")
    phone: Optional[str] = Field(default=None, description="Primary phone number")
    current_location: Optional[str] = Field(
        default=None, description="Current city / region / country"
    )
    linkedin_url: Optional[str] = Field(default=None, description="LinkedIn profile URL")
    portfolio_url: Optional[str] = Field(
        default=None, description="Portfolio / GitHub / personal site URL"
    )

    summary: Optional[str] = Field(
        default=None, description="Professional summary / objective, if present"
    )
    skills: List[str] = Field(
        default_factory=list, description="Technical and professional skills"
    )
    certifications: List[str] = Field(
        default_factory=list, description="Certifications / licenses"
    )
    education: List[Education] = Field(
        default_factory=list, description="Education history"
    )
    previous_employers: List[Employment] = Field(
        default_factory=list, description="Work history, most recent first"
    )
    years_of_experience: Optional[float] = Field(
        default=None,
        description="Total years of professional experience (estimate from work history)",
    )
