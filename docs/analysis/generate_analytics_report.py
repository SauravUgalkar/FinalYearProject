from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.graphics.shapes import Drawing, String
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import VerticalBarChart


OUTPUT_PDF = "docs/analysis/CollabCode_Analytics_Report_Demo_project_for_testing_2026-04-04.pdf"


def build_report():
    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title="CollabCode Analytics Report",
        author="CollabCode",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=8,
    )
    h2_style = ParagraphStyle(
        "H2Style",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6,
        spaceBefore=8,
    )
    normal_style = ParagraphStyle(
        "NormalStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#334155"),
    )
    tiny_style = ParagraphStyle(
        "TinyStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#64748b"),
    )

    # Source-of-truth values provided by user
    project_name = "Demo project for testing"
    description = "this project created for the testing purpose"
    tech_stack = "Java, JavaScript"
    collaborators_count = 2
    generated_date = "April 4, 2026"

    stats = {
        "Total Runs": 36,
        "Successful Runs": 27,
        "Failed Runs": 9,
        "Currently Running": 0,
        "Success Rate": "75%",
        "Failure Rate": "25%",
    }

    users_roles = [
        ["mayur", "mayur@gmail.com", "Editor", "Mar 31, 2026"],
        ["saurav", "-", "Owner", "-"],
    ]

    per_user_summary = [
        ["saurav", "34", "25", "9", "73.53%"],
        ["mayur", "2", "2", "0", "100%"],
    ]

    successful_records = [
        ["saurav", "java", "8999 ms", "Apr 4, 11:22 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "javascript", "251 ms", "Apr 4, 11:21 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "java", "8311 ms", "Apr 4, 11:21 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "javascript", "407 ms", "Apr 4, 11:21 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "java", "8611 ms", "Apr 4, 10:40 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "java", "8752 ms", "Apr 4, 10:37 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "javascript", "1642 ms", "Apr 4, 10:36 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "javascript", "1441 ms", "Apr 4, 10:36 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "java", "9525 ms", "Apr 4, 2:45 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "javascript", "240 ms", "Apr 4, 2:01 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "java", "8841 ms", "Apr 4, 1:52 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "java", "0 ms", "Apr 2, 1:19 PM", "Success", "N/A", "-", "N/A"],
        ["saurav", "java", "0 ms", "Apr 2, 12:39 PM", "Success", "N/A", "-", "N/A"],
        ["saurav", "javascript", "0 ms", "Apr 2, 12:33 PM", "Success", "N/A", "-", "N/A"],
        ["saurav", "java", "0 ms", "Apr 1, 11:35 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "javascript", "0 ms", "Apr 1, 11:30 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "javascript", "0 ms", "Apr 1, 11:30 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "java", "0 ms", "Apr 1, 11:29 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "javascript", "0 ms", "Apr 1, 11:28 AM", "Success", "N/A", "-", "N/A"],
        ["mayur", "javascript", "0 ms", "Apr 1, 9:57 AM", "Success", "N/A", "-", "N/A"],
        ["mayur", "javascript", "0 ms", "Apr 1, 9:57 AM", "Success", "N/A", "-", "N/A"],
        ["saurav", "javascript", "0 ms", "Mar 31, 2:07-3:00 PM (multiple runs)", "Success", "N/A", "-", "N/A"],
    ]

    error_records = [
        ["saurav", "java", "N/A", "Apr 4, 10:36 AM", "Error", "N/A", "Java error (details not provided)", "N/A"],
        ["saurav", "java", "N/A", "Apr 4, 10:36 AM", "Error", "N/A", "Java error (details not provided)", "N/A"],
        ["saurav", "java", "N/A", "Apr 1, 11:34 AM", "Error", "N/A", "Java error (details not provided)", "N/A"],
        ["saurav", "java", "N/A", "Apr 1, 11:33 AM", "Error", "N/A", "Java error (details not provided)", "N/A"],
        ["saurav", "java", "N/A", "Apr 1, 11:28 AM", "Error", "N/A", "Java error (details not provided)", "N/A"],
        ["saurav", "java", "N/A", "Mar 31, 2:01 PM", "Error", "N/A", "Java error (details not provided)", "N/A"],
        ["saurav", "java", "N/A", "Mar 31, 1:59 PM", "Error", "N/A", "Java error (details not provided)", "N/A"],
        ["saurav", "java", "N/A", "Mar 31, 1:58 PM", "Error", "N/A", "Java error (details not provided)", "N/A"],
        ["saurav", "java", "N/A", "Mar 31, 1:57 PM", "Error", "N/A", "Java error (details not provided)", "N/A"],
    ]

    story = []

    story.append(Paragraph("CollabCode Analytics Report", title_style))
    story.append(Paragraph(f"Generated Date: {generated_date}", normal_style))
    story.append(Spacer(1, 4))

    # Project info card
    story.append(Paragraph("Project Summary", h2_style))
    project_table = Table(
        [
            ["Project Name", project_name],
            ["Description", description],
            ["Tech Stack", tech_stack],
            ["Total Collaborators", str(collaborators_count)],
        ],
        colWidths=[48 * mm, 128 * mm],
    )
    project_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(project_table)

    story.append(Paragraph("Execution Statistics", h2_style))
    stats_table = Table(
        [["Metric", "Value"]] + [[k, str(v)] for k, v in stats.items()],
        colWidths=[85 * mm, 40 * mm],
    )
    stats_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#ffffff")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#1e293b")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(stats_table)
    story.append(Spacer(1, 6))

    # Charts section
    story.append(Paragraph("Visual Analytics", h2_style))

    chart_drawing = Drawing(180 * mm, 62 * mm)

    pie = Pie()
    pie.x = 8 * mm
    pie.y = 8 * mm
    pie.width = 52 * mm
    pie.height = 42 * mm
    pie.data = [27, 9]
    pie.labels = ["Success (75%)", "Failure (25%)"]
    pie.slices[0].fillColor = colors.HexColor("#16a34a")
    pie.slices[1].fillColor = colors.HexColor("#dc2626")
    pie.slices.strokeWidth = 0.5
    pie.slices.strokeColor = colors.white
    pie.sideLabels = True
    chart_drawing.add(pie)
    chart_drawing.add(String(12 * mm, 52 * mm, "Success vs Failure", fontName="Helvetica-Bold", fontSize=9, fillColor=colors.HexColor("#0f172a")))

    bar = VerticalBarChart()
    bar.x = 86 * mm
    bar.y = 10 * mm
    bar.height = 40 * mm
    bar.width = 86 * mm
    bar.data = [[10, 10, 3, 13]]
    bar.categoryAxis.categoryNames = ["Mar 31", "Apr 1", "Apr 2", "Apr 4"]
    bar.valueAxis.valueMin = 0
    bar.valueAxis.valueMax = 15
    bar.valueAxis.valueStep = 3
    bar.bars[0].fillColor = colors.HexColor("#0ea5e9")
    bar.bars[0].strokeColor = colors.HexColor("#0284c7")
    bar.groupSpacing = 10
    bar.barSpacing = 4
    chart_drawing.add(bar)
    chart_drawing.add(String(88 * mm, 52 * mm, "Execution Count Over Time", fontName="Helvetica-Bold", fontSize=9, fillColor=colors.HexColor("#0f172a")))

    story.append(chart_drawing)

    story.append(Paragraph("Users & Roles", h2_style))
    users_table = Table(
        [["User", "Email", "Role", "Joined"]] + users_roles,
        colWidths=[35 * mm, 62 * mm, 28 * mm, 40 * mm],
    )
    users_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#1e293b")),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(users_table)

    story.append(Paragraph("Per User Execution Summary", h2_style))
    user_exec_table = Table(
        [["User", "Total Runs", "Success", "Failed", "Success Rate"]] + per_user_summary,
        colWidths=[35 * mm, 30 * mm, 28 * mm, 28 * mm, 40 * mm],
    )
    user_exec_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#1e293b")),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(user_exec_table)

    story.append(PageBreak())

    story.append(Paragraph("Detailed Execution History", h2_style))
    story.append(Paragraph("Successful Runs", h2_style))

    success_header = ["User", "Language", "Exec Time", "Date & Time", "Status", "Output", "Error", "File Name"]
    success_table = Table(
        [success_header] + successful_records,
        colWidths=[17 * mm, 21 * mm, 18 * mm, 36 * mm, 16 * mm, 16 * mm, 30 * mm, 19 * mm],
        repeatRows=1,
    )
    success_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#166534")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#bbf7d0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#dcfce7")),
                ("FONTSIZE", (0, 0), (-1, -1), 6.8),
                ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#14532d")),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f0fdf4")),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(success_table)

    story.append(Spacer(1, 6))
    story.append(Paragraph("Error Runs", h2_style))

    error_header = ["User", "Language", "Exec Time", "Date & Time", "Status", "Output", "Error", "File Name"]
    errors_table = Table(
        [error_header] + error_records,
        colWidths=[17 * mm, 21 * mm, 18 * mm, 36 * mm, 16 * mm, 16 * mm, 30 * mm, 19 * mm],
        repeatRows=1,
    )
    errors_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#991b1b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#fecaca")),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#fee2e2")),
                ("FONTSIZE", (0, 0), (-1, -1), 6.8),
                ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#7f1d1d")),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#fef2f2")),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(errors_table)

    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            "Note: Some successful records were provided as grouped time ranges; they are listed exactly as provided without inventing missing execution metadata.",
            tiny_style,
        )
    )

    def draw_header_footer(canvas, _doc):
        canvas.saveState()
        width, height = A4

        canvas.setFillColor(colors.HexColor("#e2e8f0"))
        canvas.rect(0, height - 15 * mm, width, 15 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#0f172a"))
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(14 * mm, height - 9.5 * mm, "CollabCode Analytics Report")

        canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
        canvas.line(14 * mm, 11 * mm, width - 14 * mm, 11 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.drawString(14 * mm, 7 * mm, f"Generated: {generated_date}")
        canvas.drawRightString(width - 14 * mm, 7 * mm, f"Page {canvas.getPageNumber()}")
        canvas.restoreState()

    doc.build(story, onFirstPage=draw_header_footer, onLaterPages=draw_header_footer)


if __name__ == "__main__":
    build_report()
